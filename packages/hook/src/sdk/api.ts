import { DEFAULT_HTTP_API_ENDPOINTS, HttpApiEndpointKey } from '@grafana-fast/api';

export const DEFAULT_BASE_URL = '/api';

/**
 * DashboardApi（对外导出）
 *
 * 说明：
 * - 这里保持原来的 export 名称（DashboardApi / DEFAULT_DASHBOARD_ENDPOINTS），避免上层改动
 * - 但内部实现改为复用 @grafana-fast/api 的 HttpApiEndpointKey/DEFAULT_HTTP_API_ENDPOINTS：
 *   - endpoint key 统一来源，避免 dashboard/hook/api 三处各写一份导致不一致
 *   - 未来接入真实后端时，主要在 @grafana-fast/api 的 http 实现层维护路径与 DTO 适配
 */
export const DashboardApi = HttpApiEndpointKey;
export type DashboardApi = HttpApiEndpointKey;
export const DEFAULT_DASHBOARD_ENDPOINTS: Record<DashboardApi, string> = DEFAULT_HTTP_API_ENDPOINTS;
