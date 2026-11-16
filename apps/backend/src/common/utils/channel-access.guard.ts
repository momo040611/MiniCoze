import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-code';
import { BusinessException } from '../exceptions/business.exception';

/**
 * 发布渠道访问配置（PublishChannel.config 中的字段）：
 * {
 *   "rateLimitPerMinute": 60,          // 每 IP 每分钟最大请求数，缺省不限
 *   "allowedIps": ["1.2.3.4", "10.0.0.0/8"], // IP 白名单（精确或 IPv4 CIDR），非空时白名单外 403
 *   "allowedOrigins": ["https://a.com", "https://*.example.com"] // Origin 白名单，非空时域外 403
 * }
 */
export interface ChannelAccessConfig {
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  allowedOrigins?: string[];
}

export interface ChannelAccessInput {
  channelId: string;
  ip?: string;
  origin?: string;
}

interface SlidingWindow {
  timestamps: number[];
  lastActiveAt: number;
}

const WINDOW_MS = 60_000;
// 空闲窗口回收阈值，避免 Map 无限增长。
const WINDOW_IDLE_GC_MS = 10 * 60_000;
const MAX_WINDOW_ENTRIES = 10_000;

/**
 * 发布渠道访问守卫（纯静态工具，跨模块共享单例状态）：
 * - 内存滑动窗口限流（IP + 渠道维度），超限抛 429
 * - IP 白名单（精确值或 IPv4 CIDR），白名单外抛 403
 * - Origin 白名单（支持 https://*.example.com 通配子域），域外抛 403
 * 仅对配置了对应字段的渠道生效；字段缺省时直接放行。
 */
export class ChannelAccessGuard {
  private static readonly windows = new Map<string, SlidingWindow>();

  static enforce(config: ChannelAccessConfig | undefined, input: ChannelAccessInput): void {
    if (!config) return;

    const allowedIps = config.allowedIps ?? [];
    if (allowedIps.length > 0) {
      if (!input.ip || !ChannelAccessGuard.isIpAllowed(input.ip, allowedIps)) {
        throw new BusinessException(
          '当前 IP 不在该渠道的访问白名单内',
          ErrorCode.Forbidden,
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const allowedOrigins = config.allowedOrigins ?? [];
    if (allowedOrigins.length > 0) {
      if (!input.origin || !ChannelAccessGuard.isOriginAllowed(input.origin, allowedOrigins)) {
        throw new BusinessException(
          '当前来源不在该渠道的 Origin 白名单内',
          ErrorCode.Forbidden,
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const rateLimit = config.rateLimitPerMinute;
    if (rateLimit && rateLimit > 0) {
      ChannelAccessGuard.enforceRateLimit(input.channelId, input.ip, rateLimit);
    }
  }

  private static enforceRateLimit(channelId: string, ip: string | undefined, limit: number): void {
    if (!ip) {
      // 无 IP（极端代理配置）时不做限流，避免全部请求共享同一桶被误杀。
      return;
    }

    const now = Date.now();
    ChannelAccessGuard.gc(now);

    const key = `${channelId}:${ip}`;
    const window = ChannelAccessGuard.windows.get(key) ?? { timestamps: [], lastActiveAt: now };
    window.timestamps = window.timestamps.filter((ts) => now - ts < WINDOW_MS);
    window.lastActiveAt = now;

    if (window.timestamps.length >= limit) {
      ChannelAccessGuard.windows.set(key, window);
      throw new BusinessException(
        '请求过于频繁，请稍后再试',
        ErrorCode.TooManyRequests,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.timestamps.push(now);
    ChannelAccessGuard.windows.set(key, window);
  }

  private static gc(now: number): void {
    if (ChannelAccessGuard.windows.size < MAX_WINDOW_ENTRIES) return;

    for (const [key, window] of ChannelAccessGuard.windows) {
      if (now - window.lastActiveAt > WINDOW_IDLE_GC_MS) {
        ChannelAccessGuard.windows.delete(key);
      }
    }
  }

  private static isIpAllowed(ip: string, allowedIps: string[]): boolean {
    return allowedIps.some((rule) => {
      if (rule === ip) return true;
      if (rule.includes('/')) return ChannelAccessGuard.isIpInCidr(ip, rule);
      return false;
    });
  }

  private static isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bitsRaw] = cidr.split('/');
    const bits = Number(bitsRaw);
    const ipInt = ChannelAccessGuard.ipv4ToInt(ip);
    const rangeInt = ChannelAccessGuard.ipv4ToInt(range);
    if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      // 无法解析的规则按不匹配处理（配置错误不应放行）。
      return false;
    }

    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((ipInt & mask) >>> 0) === ((rangeInt & mask) >>> 0);
  }

  private static ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
      const value = Number(part);
      if (!Number.isInteger(value) || value < 0 || value > 255) return null;
      result = (result << 8) | value;
    }
    return result >>> 0;
  }

  private static isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.some((rule) => {
      if (rule === origin) return true;

      // https://*.example.com → 通配任意一级/多级子域，且 scheme 必须与规则一致。
      const wildcardMatch = /^(https?):\/\/\*\.([a-z0-9.-]+)$/i.exec(rule);
      if (wildcardMatch) {
        const scheme = wildcardMatch[1].toLowerCase();
        const suffix = wildcardMatch[2].toLowerCase();
        const originMatch = new RegExp(`^${scheme}://([^/:]+)(:\\d+)?$`, 'i').exec(origin);
        if (!originMatch) return false;
        const host = originMatch[1].toLowerCase();
        return host === suffix || host.endsWith(`.${suffix}`);
      }

      return false;
    });
  }
}
