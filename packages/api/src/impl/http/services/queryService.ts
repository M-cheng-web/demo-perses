/**
 * 文件说明：QueryService 的 HTTP 实现（占位）
 *
 * 说明：
 * - 该文件负责把“真实后端查询 API”适配成 contracts 的 QueryService
 * - QueryRunner/调度器在上层做并发、缓存、取消；这里负责把 signal 等信息透传给后端
 */

import type { QueryService } from '../../../contracts/query';
import type { CanonicalQuery, QueryContext, QueryResult, TimeRange } from '@grafana-fast/types';
import type { FetchHttpClient } from '../fetchClient';
import type { HttpApiEndpointKey } from '../endpoints';
import { HttpApiEndpointKey as EndpointKey, getEndpointPath } from '../endpoints';
import { normalizeArrayResponse } from './responseUtils';

export interface HttpQueryServiceDeps {
  http: FetchHttpClient;
  endpoints: Record<HttpApiEndpointKey, string>;
}

export function createHttpQueryService(_deps: HttpQueryServiceDeps): QueryService {
  /**
   * 这里实现“常用且足够通用”的 QueryService HTTP 行为：
   *
   * - executeQueries：POST /queries/execute（默认占位路径）
   *   - body：{ queries, context }
   *   - signal：透传给 fetch（支持取消/过期）
   *
   * 说明：
   * - 我们不在这里做“重型的 DTO 适配框架”，只保留最常用的结构
   * - 如果后端要求不同字段名，你只需要在这个方法里改一次映射即可
   *
   * - fetchMetrics / fetchLabelKeys / fetchLabelValues：
   *   - 用于 QueryBuilder 的联想提示
   *   - 如需缓存，优先在上层 QueryRunner/调度器做（更符合“不要过度设计”）
   */
  return {
    async executeQueries(queries: CanonicalQuery[], context: QueryContext, options): Promise<QueryResult[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.ExecuteQueries);
      const res = await _deps.http.post<unknown>(path, { queries, context }, { signal: options?.signal });
      return normalizeArrayResponse<QueryResult>(res);
    },

    async fetchMetrics(search?: string, options?): Promise<string[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.FetchMetrics);
      const res = await _deps.http.get<unknown>(path, { query: search ? { search } : undefined, signal: options?.signal });
      return normalizeArrayResponse<string>(res);
    },

    async fetchLabelKeys(metric: string, options?): Promise<string[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.FetchLabelKeys);
      const res = await _deps.http.get<unknown>(path, { query: { metric }, signal: options?.signal });
      return normalizeArrayResponse<string>(res);
    },

    async fetchLabelValues(metric: string, labelKey: string, otherLabels?: Record<string, string>, options?): Promise<string[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.FetchLabelValues);
      const res = await _deps.http.get<unknown>(path, {
        query: {
          metric,
          labelKey,
          // 说明：otherLabels 的传输形态后端可能不同；这里先用“扁平化”方案，后续按文档调整
          ...(otherLabels ?? {}),
        },
        signal: options?.signal,
      });
      return normalizeArrayResponse<string>(res);
    },

    /**
     * （可选）支持 query 型变量：
     *
     * 说明：
     * - VariableService.resolveOptions 会优先使用 queryService.fetchVariableValues（若存在）
     * - 如果你的后端提供了变量解析专用接口，可在 endpoints.FetchVariableValues 上对接
     * - 目前先实现一个“通用占位”：POST { expr, timeRange }
     */
    async fetchVariableValues(expr: string, timeRange: TimeRange, options?) {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.FetchVariableValues);
      const res = await _deps.http.post<unknown>(path, { expr, timeRange }, { signal: options?.signal });
      // 约定返回 [{ text, value }]；若后端不同，在这里做一次映射即可
      return normalizeArrayResponse<{ text: string; value: string }>(res);
    },
  };
}
