/**
 * 基于 fetch 的轻量 HTTP 封装（transport 层基础设施）
 *
 * 设计原则：
 * - 对调用方尽量“好用”：get/post 一行即可发请求；默认 JSON；支持 query 参数
 * - 对实现层尽量“可控”：错误结构统一、可注入 fetch（便于测试/SSR）、可注入鉴权 headers
 * - 不强绑业务 DTO：该文件只解决 transport（HTTP）层问题，DTO 适配应放在具体服务实现中
 */

import { isAbsoluteUrl, joinUrl, toQueryString } from '../url';
import type { UrlQueryValue } from '../url';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * query 参数支持的值类型（足够覆盖常见业务）
 * - 数组会被展开成重复 key（例如 a=1&a=2）
 * - undefined / null 会被忽略
 */
export type HttpQueryValue = UrlQueryValue;

/**
 * 可注入的 fetch：默认使用全局 fetch（浏览器环境）
 * - 允许宿主应用在 SSR/测试环境注入自定义实现
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type HeadersLike = Record<string, string> | Headers;

export interface HttpClientConfig {
  /**
   * baseURL（可选）
   *
   * 示例：
   * - https://example.com
   * - /api
   *
   * 说明：
   * - 传入相对路径时，最终 URL 仍由浏览器根据当前 origin 解析
   */
  baseUrl?: string;

  /**
   * 默认 headers（可选）
   * - 适合配置固定 headers：例如 Accept、X-Client 等
   */
  headers?: HeadersLike;

  /**
   * 动态 headers（可选）
   *
   * 典型场景：
   * - 从 localStorage/pinia 中读取 token
   * - 每次请求前动态刷新 Authorization
   */
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;

  /**
   * 默认超时（毫秒）
   * - 单次请求可覆盖
   */
  timeoutMs?: number;

  /**
   * 注入 fetch（可选）
   * - 默认使用全局 fetch
   */
  fetch?: FetchLike;

  /**
   * 默认 credentials（可选）
   * - same-origin：同源携带 cookie
   * - include：跨域也携带 cookie（需要服务端 CORS 配置）
   */
  credentials?: RequestCredentials;
}

export interface HttpRequestOptions {
  /**
   * 请求方法（默认 GET）
   */
  method?: HttpMethod;

  /**
   * 请求路径：
   * - 可以是绝对 URL（https://...）
   * - 也可以是相对路径（/api/... 或 api/...），会与 baseUrl 拼接
   */
  url: string;

  /**
   * query 参数（可选）
   */
  query?: Record<string, HttpQueryValue>;

  /**
   * 请求头（可选）
   * - 会覆盖同名默认 headers
   */
  headers?: HeadersLike;

  /**
   * 请求体（可选）
   * - 默认会按 JSON 发送（并设置 Content-Type: application/json）
   * - 若传入 string/FormData/Blob/ArrayBuffer 等，会自动使用 raw body（不做 JSON stringify）
   */
  body?: unknown;

  /**
   * 响应解析方式（默认 json）
   * - json：优先解析 JSON（空响应返回 undefined）
   * - text：返回字符串
   * - raw：返回原始 Response（上层自行处理）
   */
  responseType?: 'json' | 'text' | 'raw';

  /**
   * 单次请求超时（毫秒）
   * - 会覆盖 HttpClientConfig.timeoutMs
   */
  timeoutMs?: number;

  /**
   * 取消信号（可选）
   */
  signal?: AbortSignal;

  /**
   * 透传给 fetch 的其他选项（可选）
   * - 例如 mode/cache/keepalive/referrerPolicy 等
   * - 注意：method/headers/body/signal 会由封装层统一管理
   */
  fetchOptions?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
}

/**
 * HTTP 错误（用于统一非 2xx 的情况）
 */
export class HttpError extends Error {
  readonly name = 'HttpError';
  readonly method: HttpMethod;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly responseText?: string;
  readonly responseJson?: unknown;

  constructor(params: {
    message: string;
    method: HttpMethod;
    url: string;
    status: number;
    statusText: string;
    responseText?: string;
    responseJson?: unknown;
  }) {
    super(params.message);
    this.method = params.method;
    this.url = params.url;
    this.status = params.status;
    this.statusText = params.statusText;
    this.responseText = params.responseText;
    this.responseJson = params.responseJson;
  }
}

/**
 * 超时错误（统一成可识别的类型）
 */
export class HttpTimeoutError extends Error {
  readonly name = 'HttpTimeoutError';
  readonly timeoutMs: number;
  readonly method: HttpMethod;
  readonly url: string;

  constructor(params: { timeoutMs: number; method: HttpMethod; url: string }) {
    super(`[http] request timeout after ${params.timeoutMs}ms: ${params.method} ${params.url}`);
    this.timeoutMs = params.timeoutMs;
    this.method = params.method;
    this.url = params.url;
  }
}

/**
 * 取消错误（统一成可识别的类型）
 */
export class HttpAbortError extends Error {
  readonly name = 'HttpAbortError';
  readonly method: HttpMethod;
  readonly url: string;

  constructor(params: { method: HttpMethod; url: string }) {
    super(`[http] request aborted: ${params.method} ${params.url}`);
    this.method = params.method;
    this.url = params.url;
  }
}

/**
 * 类型守卫：判断是否为 HttpError
 */
export function isHttpError(err: unknown): err is HttpError {
  if (err instanceof HttpError) return true;
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'HttpError';
}

/**
 * 类型守卫：判断是否为超时错误
 */
export function isHttpTimeoutError(err: unknown): err is HttpTimeoutError {
  if (err instanceof HttpTimeoutError) return true;
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'HttpTimeoutError';
}

/**
 * 类型守卫：判断是否为取消错误
 */
export function isHttpAbortError(err: unknown): err is HttpAbortError {
  if (err instanceof HttpAbortError) return true;
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'HttpAbortError';
}

export interface FetchHttpClient {
  /**
   * 发起请求的统一入口
   * - 默认解析 JSON
   * - 非 2xx 统一抛 HttpError
   */
  request: <T = unknown>(options: HttpRequestOptions) => Promise<T>;

  /**
   * GET 请求（默认 JSON）
   */
  get: <T = unknown>(url: string, options?: Omit<HttpRequestOptions, 'method' | 'url'>) => Promise<T>;

  /**
   * POST 请求（默认 JSON）
   */
  post: <T = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'url' | 'body'>) => Promise<T>;

  /**
   * PUT 请求（默认 JSON）
   */
  put: <T = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'url' | 'body'>) => Promise<T>;

  /**
   * PATCH 请求（默认 JSON）
   */
  patch: <T = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'url' | 'body'>) => Promise<T>;

  /**
   * DELETE 请求（默认 JSON）
   */
  delete: <T = unknown>(url: string, options?: Omit<HttpRequestOptions, 'method' | 'url'>) => Promise<T>;
}

/**
 * 创建一个基于 fetch 的 HTTP client
 *
 * @example
 * const http = createFetchHttpClient({ baseUrl: '/api', timeoutMs: 8000 });
 * const res = await http.get<MyDto>('/dashboards');
 */
export function createFetchHttpClient(config: HttpClientConfig = {}): FetchHttpClient {
  const fetchImpl: FetchLike | undefined = config.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  if (!fetchImpl) {
    throw new Error('[grafana-fast/utils] fetch is not available in current runtime; please provide HttpClientConfig.fetch');
  }

  const request: FetchHttpClient['request'] = async <T>(options: HttpRequestOptions): Promise<T> => {
    const method: HttpMethod = options.method ?? 'GET';
    const responseType = options.responseType ?? 'json';
    const fullUrl = buildUrl({ baseUrl: config.baseUrl, url: options.url, query: options.query });

    const { signal, cleanup, timeoutMs, didTimeout } = createAbortSignal({
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? config.timeoutMs,
    });

    try {
      const mergedHeaders = await mergeHeaders(config, options.headers, options.body);

      const body = toBodyInit(options.body, mergedHeaders);
      const res = await fetchImpl(fullUrl, {
        method,
        headers: mergedHeaders,
        body,
        signal,
        credentials: options.fetchOptions?.credentials ?? config.credentials ?? 'same-origin',
        ...options.fetchOptions,
      });

      if (responseType === 'raw') {
        return res as unknown as T;
      }

      if (!res.ok) {
        const { responseJson, responseText } = await tryReadErrorBody(res);
        throw new HttpError({
          message: `[http] ${method} ${fullUrl} failed: ${res.status} ${res.statusText}`,
          method,
          url: fullUrl,
          status: res.status,
          statusText: res.statusText,
          responseJson,
          responseText,
        });
      }

      if (responseType === 'text') {
        return (await res.text()) as unknown as T;
      }

      // json
      if (res.status === 204) {
        return undefined as unknown as T;
      }

      const text = await res.text();
      if (!text.trim()) {
        return undefined as unknown as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new HttpError({
          message: `[http] ${method} ${fullUrl} returned invalid json`,
          method,
          url: fullUrl,
          status: res.status,
          statusText: res.statusText,
          responseText: text,
        });
      }
    } catch (err: unknown) {
      if (isAbortError(err)) {
        if (didTimeout && timeoutMs != null) {
          throw new HttpTimeoutError({ timeoutMs, method, url: fullUrl });
        }
        throw new HttpAbortError({ method, url: fullUrl });
      }
      throw err;
    } finally {
      cleanup();
    }
  };

  return {
    request,
    get: (url, options) => request({ ...options, url, method: 'GET' }),
    post: (url, body, options) => request({ ...options, url, body, method: 'POST' }),
    put: (url, body, options) => request({ ...options, url, body, method: 'PUT' }),
    patch: (url, body, options) => request({ ...options, url, body, method: 'PATCH' }),
    delete: (url, options) => request({ ...options, url, method: 'DELETE' }),
  };
}

function buildUrl(params: { baseUrl?: string; url: string; query?: Record<string, HttpQueryValue> }): string {
  const { baseUrl, url, query } = params;
  const joined = joinUrl(baseUrl, url);
  const qs = query ? toQueryString(query) : '';
  if (!qs) return joined;
  return joined.includes('?') ? `${joined}&${qs}` : `${joined}?${qs}`;
}

async function mergeHeaders(config: HttpClientConfig, perRequest: HeadersLike | undefined, body: unknown): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  const base = normalizeHeaders(config.headers);
  Object.assign(out, base);

  const dynamic = config.getHeaders ? await config.getHeaders() : undefined;
  if (dynamic) Object.assign(out, dynamic);

  const req = normalizeHeaders(perRequest);
  Object.assign(out, req);

  // 默认 JSON：如果 body 是一个“普通对象”，自动给 Content-Type
  if (shouldSetJsonContentType(body) && !hasHeader(out, 'content-type')) {
    out['Content-Type'] = 'application/json; charset=utf-8';
  }

  if (!hasHeader(out, 'accept')) {
    out['Accept'] = 'application/json, text/plain, */*';
  }

  return out;
}

function normalizeHeaders(headers: HeadersLike | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((v, k) => {
      record[k] = v;
    });
    return record;
  }
  return { ...headers };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

function shouldSetJsonContentType(body: unknown): boolean {
  if (body == null) return false;
  if (typeof body === 'string') return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  return typeof body === 'object';
}

function toBodyInit(body: unknown, headers: Record<string, string>): BodyInit | undefined {
  if (body == null) return undefined;
  if (typeof body === 'string') return body;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body;

  if (shouldSetJsonContentType(body)) {
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }
    return JSON.stringify(body);
  }

  return body as BodyInit;
}

async function tryReadErrorBody(res: Response): Promise<{ responseJson?: unknown; responseText?: string }> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return { responseJson: JSON.parse(text), responseText: text };
  } catch {
    return { responseText: text };
  }
}

function createAbortSignal(params: { signal?: AbortSignal; timeoutMs?: number }): {
  signal: AbortSignal | undefined;
  cleanup: () => void;
  timeoutMs: number | undefined;
  didTimeout: boolean;
} {
  const timeoutMs = params.timeoutMs;
  if (!params.signal && timeoutMs == null) {
    return { signal: undefined, cleanup: () => {}, timeoutMs: undefined, didTimeout: false };
  }

  const controller = new AbortController();
  const cleanupFns: Array<() => void> = [];
  let didTimeout = false;

  if (params.signal) {
    if (params.signal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      params.signal.addEventListener('abort', onAbort, { once: true });
      cleanupFns.push(() => params.signal?.removeEventListener('abort', onAbort));
    }
  }

  if (timeoutMs != null) {
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
    cleanupFns.push(() => clearTimeout(timer));
  }

  return {
    signal: controller.signal,
    cleanup: () => cleanupFns.forEach((fn) => fn()),
    timeoutMs,
    didTimeout,
  };
}

function isAbortError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const anyErr = err as { name?: unknown; message?: unknown };
  if (anyErr.name === 'AbortError') return true;
  if (typeof anyErr.message === 'string' && anyErr.message.toLowerCase().includes('aborted')) return true;
  return false;
}
