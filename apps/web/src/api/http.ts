export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}
export interface RequestOptions<TBody = unknown>
  extends Omit<RequestInit, 'body' | 'method' | 'headers'> {
  method?: HttpMethod;
  query?: QueryParams;
  body?: TBody;
  headers?: HeadersInit;
  timeout?: number;
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: number | string;
  payload?: unknown;

  constructor(message: string, status: number, code?: number | string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  '/api';

const DEFAULT_TIMEOUT = 15000;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
}

// Mock 拦截器类型：传入请求体和请求头，返回模拟的响应数据
type MockHandler = (body: unknown, headers: Headers) => Promise<unknown>;

const mockHandlers = new Map<string, MockHandler>();

export function registerMockHandler(method: HttpMethod, path: string, handler: MockHandler) {
  mockHandlers.set(`${method}:${path}`, handler);
}

export function clearMockHandlers() {
  mockHandlers.clear();
}

// 判断请求体是否属于浏览器原生可直接发送的类型，这类数据不应该被 JSON.stringify。
function isNativeBody(body: unknown): body is BodyInit {
  return (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams ||
    typeof body === 'string'
  );
}

function toQueryString(query?: QueryParams) {
  if (!query) {
    return '';
  }

  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined) {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

function buildUrl(path: string, query?: QueryParams) {
  const isAbsoluteUrl = /^https?:\/\//i.test(path);
  const baseUrl = isAbsoluteUrl ? path : `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const queryString = toQueryString(query);

  if (!queryString) {
    return baseUrl;
  }

  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryString}`;
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json() as Promise<unknown>;
  }

  return response.text();
}

function createHeaders(body: unknown, headers?: HeadersInit, auth = true) {
  const finalHeaders = new Headers(headers);

  if (auth && authToken && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  if (body !== undefined && !isNativeBody(body) && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  return finalHeaders;
}

function createBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (isNativeBody(body)) {
    return body;
  }

  return JSON.stringify(body);
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.msg ?? record.error;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function getErrorCode(payload: unknown) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const code = record.code;

    if (typeof code === 'string' || typeof code === 'number') {
      return code;
    }
  }

  return undefined;
}

export async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
) {
  const {
    method = 'GET',
    query,
    body,
    headers,
    timeout = DEFAULT_TIMEOUT,
    auth = true,
    signal,
    ...fetchOptions
  } = options;

  const mockKey = `${method}:${path}`;
  let mockHandler = mockHandlers.get(mockKey);

  // 未命中精确匹配时，尝试 RESTful 前缀匹配（如 GET:agents 匹配 GET:agents/some-id）
  // 按路径长度降序排列，确保更具体的路径（如 workspaces/default-workspace）优先于短路径（如 workspaces）
  if (!mockHandler) {
    const candidates = Array.from(mockHandlers.entries())
      .filter(([key]) => {
        const sepIdx = key.indexOf(':');
        if (sepIdx === -1) return false;
        const keyMethod = key.slice(0, sepIdx);
        const keyPath = key.slice(sepIdx + 1);
        return keyMethod === method && path.startsWith(`${keyPath}/`);
      })
      .sort((a, b) => {
        const lenA = a[0].indexOf(':') !== -1 ? a[0].slice(a[0].indexOf(':') + 1).length : 0;
        const lenB = b[0].indexOf(':') !== -1 ? b[0].slice(b[0].indexOf(':') + 1).length : 0;
        return lenB - lenA; // 降序：最长（最具体）路径优先
      });

    if (candidates.length > 0) {
      mockHandler = candidates[0][1];
    }
  }

  if (mockHandler) {
    const simulateDelay = new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));
    try {
      const data = await mockHandler(body, createHeaders(body, headers, auth));
      await simulateDelay;
      return data as TResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : '请求失败',
        400,
        'MOCK_ERROR',
      );
    }
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      ...fetchOptions,
      method,
      headers: createHeaders(body, headers, auth),
      body: method === 'GET' ? undefined : createBody(body),
      signal: controller.signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(payload, response.statusText || '请求失败'),
        response.status,
        getErrorCode(payload),
        payload,
      );
    }

    return payload as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时或已取消', 0, 'REQUEST_ABORTED');
    }

    throw new ApiError(error instanceof Error ? error.message : '网络请求异常', 0, 'NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function get<TResponse>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return request<TResponse>(path, { ...options, method: 'GET' });
}

function post<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
) {
  return request<TResponse, TBody>(path, { ...options, method: 'POST', body });
}

function put<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
) {
  return request<TResponse, TBody>(path, { ...options, method: 'PUT', body });
}

function patch<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
) {
  return request<TResponse, TBody>(path, { ...options, method: 'PATCH', body });
}

function remove<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
) {
  return request<TResponse, TBody>(path, { ...options, method: 'DELETE', body });
}

export const http = {
  get,
  post,
  put,
  patch,
  delete: remove,
  request,
};
