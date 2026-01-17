/**
 * 兼容层：@grafana-fast/api 的 fetch client
 *
 * 说明：
 * - 历史上该实现属于 api 包的 http 实现层基础设施
 * - 现在收敛到 @grafana-fast/utils（更符合“transport 层可跨包复用”的定位）
 * - 该文件保留原导出路径，避免破坏外部使用方的 import
 */

export {
  createFetchHttpClient,
  isHttpAbortError,
  isHttpError,
  isHttpTimeoutError,
  HttpAbortError,
  HttpError,
  HttpTimeoutError,
  type FetchHttpClient,
  type FetchLike,
  type HeadersLike,
  type HttpClientConfig,
  type HttpMethod,
  type HttpQueryValue,
  type HttpRequestOptions,
} from '@grafana-fast/utils';
