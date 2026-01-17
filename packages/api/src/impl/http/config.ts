/**
 * 文件说明：HTTP 实现层的配置定义与归一化
 *
 * 目标：
 * - 让调用方（hook/app）以“少心智负担”的方式配置真实后端接入（baseUrl、鉴权、超时等）
 * - 同时让实现层内部保持可维护：所有参数先归一化为 ResolvedHttpApiClientConfig
 *
 * 重要原则：
 * - 调用方不应该因为后端接口/DTO 的变化而修改代码
 * - 变化应尽可能被限制在 http 实现层内部（包含 endpoint 路径、请求体/响应体适配）
 */

import type { FetchLike, HeadersLike, HttpClientConfig } from './fetchClient';
import type { HttpApiEndpointKey } from './endpoints';
import { resolveHttpApiEndpoints } from './endpoints';
import { normalizeBaseUrl } from '@grafana-fast/utils';

/**
 * 鉴权配置（可选）
 *
 * 说明：
 * - 这是“快捷配置”，用于快速接入常见的 Bearer Token 方式
 * - 如果你的鉴权更复杂（多 header、签名、cookie），也可以直接使用 apiConfig.getHeaders
 */
export interface HttpApiAuthConfig {
  /**
   * 固定 token（适合 demo / 本地调试）
   */
  bearerToken?: string;

  /**
   * 动态 token（推荐）
   * - 适合从 store/localStorage/refresh 流程中读取
   */
  getBearerToken?: () => string | Promise<string>;

  /**
   * header 名称（默认 Authorization）
   */
  headerName?: string;

  /**
   * token 前缀（默认 "Bearer "）
   */
  prefix?: string;
}

/**
 * createHttpApiClient 的配置（面向外部）
 *
 * 你可以把它理解为三层：
 * 1) transport：fetch 的注入与基础行为（timeout/credentials 等）
 * 2) headers：固定 + 动态（用于鉴权/trace）
 * 3) endpoints：预留口子，允许覆盖后端路径（通常不需要）
 */
export interface HttpApiClientConfig {
  /**
   * API 根路径（推荐使用）
   *
   * 示例：
   * - "/api"
   * - "https://example.com/api"
   */
  baseUrl?: string;

  /**
   * 默认超时（毫秒）
   */
  timeoutMs?: number;

  /**
   * 默认 credentials（cookie 策略）
   */
  credentials?: RequestCredentials;

  /**
   * 注入 fetch（可选）
   * - 在非浏览器环境（SSR/测试）时可能需要
   */
  fetch?: FetchLike;

  /**
   * 固定 headers（可选）
   */
  headers?: HeadersLike;

  /**
   * 动态 headers（可选，推荐）
   * - 每次请求前调用，适合 token/traceId 等
   */
  getHeaders?: HttpClientConfig['getHeaders'];

  /**
   * 鉴权快捷配置（可选）
   */
  auth?: HttpApiAuthConfig;

  /**
   * 预留：允许覆盖后端 endpoint 路径（可选）
   *
   * 说明：
   * - 这里的 key 是强类型（HttpApiEndpointKey），避免你手写字符串时拼错
   * - 默认值在 DEFAULT_HTTP_API_ENDPOINTS 中统一维护
   * - 后续对接真实后端时，你可以：
   *   1) 直接修改 DEFAULT_HTTP_API_ENDPOINTS（全局生效）
   *   2) 或在宿主应用里通过 apiConfig.endpoints 覆盖某几个 path（更灵活）
   */
  endpoints?: Partial<Record<HttpApiEndpointKey, string>>;
}

export interface CreateHttpApiClientOptions {
  /**
   * http 实现层配置（建议只通过这一层传入）
   */
  apiConfig?: HttpApiClientConfig;
}

export interface ResolvedHttpApiClientConfig {
  /**
   * 归一化后的 fetch client 配置（transport 层）
   */
  http: HttpClientConfig;

  /**
   * endpoint 覆盖（预留）
   */
  endpoints: Record<HttpApiEndpointKey, string>;
}

const DEFAULT_HTTP_BASE_URL = '/api';

/**
 * 将外部传入的 apiConfig 归一化为内部使用的结构
 */
export function resolveHttpApiClientConfig(apiConfig: HttpApiClientConfig | undefined): ResolvedHttpApiClientConfig {
  const baseUrl = normalizeBaseUrl(apiConfig?.baseUrl ?? DEFAULT_HTTP_BASE_URL);

  const getHeaders = composeGetHeaders(apiConfig);

  const http: HttpClientConfig = {
    baseUrl,
    headers: apiConfig?.headers,
    getHeaders,
    timeoutMs: apiConfig?.timeoutMs,
    credentials: apiConfig?.credentials,
    fetch: apiConfig?.fetch,
  };

  return {
    http,
    endpoints: resolveHttpApiEndpoints(apiConfig?.endpoints),
  };
}

function composeGetHeaders(apiConfig: HttpApiClientConfig | undefined): HttpClientConfig['getHeaders'] | undefined {
  const baseGetHeaders = apiConfig?.getHeaders;
  const auth = apiConfig?.auth;
  if (!baseGetHeaders && !auth) return undefined;

  return async () => {
    const headers: Record<string, string> = {};

    if (baseGetHeaders) {
      const extra = await baseGetHeaders();
      Object.assign(headers, extra);
    }

    if (auth) {
      const headerName = auth.headerName ?? 'Authorization';
      const prefix = auth.prefix ?? 'Bearer ';
      const token = auth.bearerToken ?? (auth.getBearerToken ? await auth.getBearerToken() : undefined);
      if (token) {
        headers[headerName] = `${prefix}${token}`;
      }
    }

    return headers;
  };
}
