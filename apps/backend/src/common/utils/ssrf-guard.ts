import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ErrorCode } from '../constants/error-code';
import { BusinessException } from '../exceptions/business.exception';

const MAX_REDIRECTS = 3;

/**
 * SSRF 防护：HTTP 出站请求（http 插件 / http 工作流节点）统一走这里校验。
 * - 仅允许 http/https
 * - DNS 解析后拒绝私网 / 环回 / 链路本地 / 保留地址
 * - 重定向逐跳复检（手动跟随，最多 3 跳）
 */
@Injectable()
export class SsrfGuard {
  private readonly logger = new Logger(SsrfGuard.name);

  /**
   * 校验 URL 并发起受保护的 fetch：
   * 每一跳重定向都重新做 DNS/IP 校验，防止「公网 URL 302 跳内网」绕过。
   */
  async safeFetch(
    rawUrl: string,
    init: Omit<RequestInit, 'redirect'> & { timeoutMs?: number },
  ): Promise<Response> {
    let currentUrl = this.validateUrl(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetch(currentUrl, {
        ...init,
        redirect: 'manual',
        signal: init.timeoutMs
          ? AbortSignal.timeout(init.timeoutMs)
          : init.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return response;
        }

        // body 需要消费掉才能释放连接。
        await response.arrayBuffer().catch(() => undefined);

        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = this.validateUrl(nextUrl);
        continue;
      }

      return response;
    }

    throw new BusinessException(
      `重定向次数超过上限（${MAX_REDIRECTS}）`,
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  /** 校验 URL 协议与目标 IP，非法直接抛业务异常。 */
  validateUrl(rawUrl: string): string {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BusinessException(
        `无效的 URL: ${rawUrl}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BusinessException(
        `仅支持 http/https 协议，收到 ${url.protocol}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname)) {
      this.ensurePublicIp(hostname, rawUrl);
      return url.toString();
    }

    return url.toString();
  }

  /**
   * DNS 解析并校验全部解析结果。
   * 注：受信任网络内 DNS rebinding 仍需出口防火墙兜底，此处覆盖常规 SSRF 面。
   */
  async validateUrlWithDns(rawUrl: string): Promise<string> {
    const url = new URL(this.validateUrl(rawUrl));
    const hostname = url.hostname.replace(/^\[|\]$/g, '');

    if (!isIP(hostname)) {
      try {
        const records = await lookup(hostname, { all: true, verbatim: true });
        for (const record of records) {
          this.ensurePublicIp(record.address, rawUrl);
        }
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error;
        }
        throw new BusinessException(
          `域名解析失败: ${hostname}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return url.toString();
  }

  private ensurePublicIp(ip: string, source: string): void {
    if (this.isPrivateIp(ip)) {
      this.logger.warn(`SSRF 拦截: ${source} -> ${ip}`);
      throw new BusinessException(
        '目标地址指向内网或保留 IP，已被拦截',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (isIP(ip) === 4) {
      return this.isPrivateIpv4(ip);
    }

    if (isIP(ip) === 6) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      // IPv4-mapped IPv6（::ffff:127.0.0.1 等）
      const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this.isPrivateIpv4(mapped[1]);
      // fc00::/7（ULA）、fe80::/10（链路本地）、2001:db8::/32（文档保留）
      if (
        lower.startsWith('fc') ||
        lower.startsWith('fd') ||
        lower.startsWith('fe8') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb')
      ) {
        return true;
      }
      return false;
    }

    return true;
  }

  private isPrivateIpv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // 链路本地（含云元数据 169.254.169.254）
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // 组播与保留段

    return false;
  }
}
