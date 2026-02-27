/**
 * 文件说明：VariableService 的 HTTP 实现
 *
 * 模式：后端全量下发变量
 * - loadVariables：POST /variables/load（加载变量列表）
 * - applyVariables：POST /variables/apply（应用变量值）
 */

import type { VariableService, VariablesRequestContext } from '../../../contracts/variable';
import type { DashboardVariable } from '@grafana-fast/types';
import type { FetchHttpClient } from '@grafana-fast/utils';
import type { HttpApiEndpointKey } from '../endpoints';
import { HttpApiEndpointKey as EndpointKey, getEndpointPath } from '../endpoints';
import { normalizeArrayResponse } from './responseUtils';

export interface HttpVariableServiceDeps {
  http: FetchHttpClient;
  endpoints: Record<HttpApiEndpointKey, string>;
}

function buildSessionHeader(context?: VariablesRequestContext): Record<string, string> | undefined {
  const key = context?.dashboardSessionKey;
  return key ? { 'X-Dashboard-Session-Key': key } : undefined;
}

export function createHttpVariableService(deps: HttpVariableServiceDeps): VariableService {
  return {
    async loadVariables(context?: VariablesRequestContext): Promise<DashboardVariable[]> {
      const path = getEndpointPath(deps.endpoints, EndpointKey.LoadVariables);
      const headers = buildSessionHeader(context);
      const res = await deps.http.post<unknown>(path, {}, { signal: context?.signal, headers });
      return normalizeArrayResponse<DashboardVariable>(res);
    },

    async applyVariables(values: Record<string, string | string[]>, context?: VariablesRequestContext): Promise<DashboardVariable[]> {
      const path = getEndpointPath(deps.endpoints, EndpointKey.ApplyVariables);
      const headers = buildSessionHeader(context);
      const body = { values: values ?? {} };
      const res = await deps.http.post<unknown>(path, body, { signal: context?.signal, headers });
      return normalizeArrayResponse<DashboardVariable>(res);
    },
  };
}
