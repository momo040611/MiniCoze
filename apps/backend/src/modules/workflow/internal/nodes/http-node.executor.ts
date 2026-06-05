import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

const DEFAULT_HTTP_TIMEOUT_MS = 30000;
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// HttpNodeExecutor：发起 HTTP 请求，用于工作流对接外部 API。
// 配置（data.inputs）：
// - url:     请求地址（支持 {{}}）
// - method:  GET/POST/PUT/PATCH/DELETE（默认 GET）
// - headers: 请求头对象，值支持 {{}}
// - body:    请求体；对象会按字段解析后 JSON 序列化，字符串走模板解析
// - timeout: 请求超时（毫秒，默认 30s）
//
// 输出：{ status, ok, data }
// - 非 2xx 不抛错（ok=false），方便后续用 selector 按状态码分支
// - 网络错误 / 超时才抛错
//
// 安全说明：未做 SSRF 防护，可访问内网地址；对外开放需加白名单/校验。
@Injectable()
export class HttpNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'http';
  private readonly logger = new Logger(HttpNodeExecutor.name);

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);

    const url = context.resolveTemplate(this.readString(inputs.url, ''));
    if (!url) {
      throw new BusinessException(
        'http 节点缺少 url',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const method = this.resolveMethod(inputs.method);
    const headers = this.resolveHeaders(inputs.headers, context);
    const body = this.resolveBody(inputs.body, method, headers, context);
    const timeoutMs = this.readNumber(inputs.timeout, DEFAULT_HTTP_TIMEOUT_MS);

    this.logger.debug(`[http] ${method} ${url} timeout=${timeoutMs}ms`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const data = await this.parseResponse(response);
      this.logger.debug(
        `[http] 响应 status=${response.status} ok=${response.ok}`,
      );

      return {
        output: {
          status: response.status,
          ok: response.ok,
          data,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `请求超时 (${timeoutMs}ms)`
          : message;
      throw new BusinessException(
        `http 节点请求失败: ${reason}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveMethod(value: unknown): string {
    const method = typeof value === 'string' ? value.toUpperCase() : 'GET';
    return ALLOWED_METHODS.includes(method) ? method : 'GET';
  }

  // 解析请求头：每个值都过一遍模板解析（支持 {{}}）。
  private resolveHeaders(
    value: unknown,
    context: WorkflowNodeExecutionContext,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    const raw = this.asRecord(value);
    for (const [key, rawValue] of Object.entries(raw)) {
      headers[key] = context.resolveTemplate(this.toStr(rawValue));
    }
    return headers;
  }

  // 解析请求体：
  // - GET/DELETE 不带 body
  // - 对象：逐字段解析（保留类型）后 JSON 序列化，并补 Content-Type
  // - 字符串：模板解析
  private resolveBody(
    value: unknown,
    method: string,
    headers: Record<string, string>,
    context: WorkflowNodeExecutionContext,
  ): string | undefined {
    if (method === 'GET' || method === 'DELETE' || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      return context.resolveTemplate(value);
    }

    if (this.isRecord(value)) {
      const resolved: Record<string, unknown> = {};
      for (const [key, rawValue] of Object.entries(value)) {
        resolved[key] = context.resolveValue(rawValue);
      }
      if (!this.hasContentType(headers)) {
        headers['Content-Type'] = 'application/json';
      }
      return JSON.stringify(resolved);
    }

    return undefined;
  }

  // 优先按 JSON 解析响应，失败则返回纯文本。
  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private hasContentType(headers: Record<string, string>): boolean {
    return Object.keys(headers).some(
      (key) => key.toLowerCase() === 'content-type',
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  private readNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  private toStr(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    return JSON.stringify(value);
  }
}
