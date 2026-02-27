/**
 * Dashboard API 相关导出：
 * - 对外提供 DashboardApi（endpoint key）与 DEFAULT_DASHBOARD_ENDPOINTS（默认路径映射）
 * - 内部实现复用 @grafana-fast/api 的 HttpApiEndpointKey/DEFAULT_HTTP_API_ENDPOINTS，避免多处维护
 */
import { DEFAULT_HTTP_API_ENDPOINTS, HttpApiEndpointKey } from '@grafana-fast/api';

export const DEFAULT_BASE_URL = '/api';

export const DashboardApi = HttpApiEndpointKey;
export type DashboardApi = HttpApiEndpointKey;
export const DEFAULT_DASHBOARD_ENDPOINTS: Record<DashboardApi, string> = DEFAULT_HTTP_API_ENDPOINTS;
