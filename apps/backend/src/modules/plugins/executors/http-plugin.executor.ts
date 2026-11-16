import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { SsrfGuard } from '../../../common/utils/ssrf-guard';
import type { RuntimeContext } from '../../../shared/types/runtime';
import { PluginCredentialService } from '../plugin-credential.service';

/**
 * HTTP 插件的请求配置约定（存放在 PluginTool.meta.request）：
 * {
 *   "handler": "http",
 *   "request": {
 *     "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
 *     "url": "https://api.example.com/weather?city={{city}}",
 *     "headers": { "X-Custom": "{{city}}" },
 *     "body": { "q": "{{query}}" },          // 非 GET 时的 JSON 体，支持 {{args}} 插值
 *     "responsePath": "data.result",         // 可选：点路径截取响应片段
 *     "timeoutMs": 15000                      // 可选：默认 15s，上限 30s
 *   }
 * }
 * 认证：插件绑定 PluginCredential（BEARER_TOKEN / API_KEY_HEADER / BASIC_AUTH），
 * 执行时自动解密注入；一个插件取最新的 ACTIVE 凭据。
 */
interface HttpToolRequestConfig {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  responsePath?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;

@Injectable()
export class HttpPluginExecutor {
  constructor(
    private readonly ssrfGuard: SsrfGuard,
    private readonly pluginCredentialService: PluginCredentialService,
  ) {}

  supports(type: string): boolean {
    return type === 'HTTP';
  }

  async execute(input: {
    pluginId: string;
    toolMeta: unknown;
    args: Record<string, unknown>;
    context?: RuntimeContext;
  }): Promise<unknown> {
    const request = this.readRequestConfig(input.toolMeta);

    if (!request.url) {
      throw new BusinessException(
        'HTTP 插件工具缺少 meta.request.url 配置',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const method = (request.method ?? 'GET').toUpperCase();
    const url = this.interpolate(request.url, input.args);
    const headers = await this.buildHeaders(input.pluginId, request, input.args);
    let body: string | undefined;

    if (!['GET', 'HEAD'].includes(method) && request.body !== undefined) {
      const rawBody = this.interpolateDeep(request.body, input.args);
      body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    // DNS 解析 + IP 校验 + 重定向逐跳复检。
    await this.ssrfGuard.validateUrlWithDns(url);
    let response: Response;
    try {
      response = await this.ssrfGuard.safeFetch(url, {
        method,
        headers,
        body,
        timeoutMs: Math.min(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        `HTTP 插件请求失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new BusinessException(
        `HTTP 插件调用失败（${response.status}）: ${responseText.slice(0, 500)}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const parsed = this.tryParseJson(responseText);
    return request.responsePath
      ? this.extractPath(parsed, request.responsePath)
      : parsed;
  }

  private readRequestConfig(toolMeta: unknown): HttpToolRequestConfig {
    if (
      toolMeta &&
      typeof toolMeta === 'object' &&
      !Array.isArray(toolMeta) &&
      toolMeta !== null
    ) {
      const request = (toolMeta as Record<string, unknown>)['request'];
      if (request && typeof request === 'object' && !Array.isArray(request)) {
        return request as HttpToolRequestConfig;
      }
    }

    return {};
  }

  /**
   * 组装请求头：工具 meta 配置头 + 插件凭据认证头（运行时解密注入）。
   */
  private async buildHeaders(
    pluginId: string,
    request: HttpToolRequestConfig,
    args: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const configured = request.headers ?? {};

    for (const [key, value] of Object.entries(configured)) {
      if (typeof value === 'string') {
        headers[key] = this.interpolate(value, args);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        headers[key] = String(value);
      }
    }

    const credential =
      await this.pluginCredentialService.getRuntimeCredential(pluginId);
    if (credential) {
      switch (credential.authType) {
        case 'BEARER_TOKEN':
          headers['Authorization'] = `Bearer ${credential.secret}`;
          break;
        case 'BASIC_AUTH':
          headers['Authorization'] = `Basic ${credential.secret}`;
          break;
        case 'API_KEY_HEADER': {
          const headerName =
            typeof credential.config['headerName'] === 'string' &&
            credential.config['headerName'].trim()
              ? credential.config['headerName']
              : 'X-API-Key';
          headers[headerName] = credential.secret;
          break;
        }
      }
    }

    return headers;
  }

  /** {{argName}} 插值：只替换目标字符串中的占位符。 */
  private interpolate(template: string, args: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
      const value = this.extractPath(args, path);
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private interpolateDeep(value: unknown, args: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return this.interpolate(value, args);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolateDeep(item, args));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.interpolateDeep(item, args),
        ]),
      );
    }

    return value;
  }

  /** 点路径取值：'data.result.items[0]' 风格，不含函数调用。 */
  private extractPath(value: unknown, path: string): unknown {
    if (!path) return value;

    return path
      .split('.')
      .flatMap((segment) => {
        // 支持 items[0] / items[0].name 形式
        const match = segment.match(/^([\w-]+)?\[(\d+)\]$/);
        if (match) {
          return [match[1] ?? '', Number(match[2])];
        }
        return [segment];
      })
      .reduce<unknown>((current, key) => {
        if (current === null || current === undefined) {
          return undefined;
        }
        if (key === '') {
          return current;
        }
        if (typeof key === 'number') {
          return Array.isArray(current) ? current[key] : undefined;
        }
        if (typeof current !== 'object') {
          return undefined;
        }
        return (current as Record<string, unknown>)[key];
      }, value);
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}
