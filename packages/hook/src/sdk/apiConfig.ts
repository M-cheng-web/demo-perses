import { url } from '@grafana-fast/utils';

import { DEFAULT_BASE_URL, DEFAULT_DASHBOARD_ENDPOINTS, type DashboardApi } from './api';
import type { DashboardSdkApiConfig, ResolvedDashboardSdkApiConfig } from './types';

export function resolveDashboardSdkApiConfig(apiConfig?: DashboardSdkApiConfig): ResolvedDashboardSdkApiConfig {
  const baseUrl = url.normalizeBase(apiConfig?.baseUrl ?? DEFAULT_BASE_URL);
  const overrides = apiConfig?.endpoints ?? {};
  const endpoints: Record<DashboardApi, string> = { ...DEFAULT_DASHBOARD_ENDPOINTS, ...overrides };
  const resolved: Record<DashboardApi, string> = Object.fromEntries(
    Object.entries(endpoints).map(([key, value]) => {
      const normalized = url.resolveEndpoint(baseUrl, value);
      return [key as DashboardApi, normalized];
    })
  ) as Record<DashboardApi, string>;
  return { baseUrl, endpoints: resolved };
}
