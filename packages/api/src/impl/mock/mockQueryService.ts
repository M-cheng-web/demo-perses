/**
 * mock QueryService
 *
 * 说明：
 * - 用内置数据池（defaultDataPool.ts）模拟 Prometheus 查询结果
 * - 同时提供 QueryBuilder 所需的 metrics/labels/value 列表能力
 */
import type { QueryService } from '../../contracts';
import type { CanonicalQuery, QueryContext, QueryResult, TimeSeriesData } from '@grafana-fast/types';
import { getDefaultDataByExpr } from './defaultDataPool';

const mockMetrics = [
  'up',
  'cpu_usage',
  'memory_usage',
  'node_cpu_seconds_total',
  'node_memory_MemAvailable_bytes',
  'http_requests_total',
  'http_request_duration_seconds',
];

const mockLabelKeys: Record<string, string[]> = {
  up: ['job', 'instance'],
  cpu_usage: ['cpu', 'instance'],
  memory_usage: ['type', 'instance'],
  http_requests_total: ['method', 'status', 'endpoint', 'instance', 'job'],
};

const mockLabelValues: Record<string, Record<string, string[]>> = {
  cpu_usage: { cpu: ['0', '1', '2', '3'], instance: ['server-1', 'server-2'] },
  memory_usage: { type: ['used', 'cached', 'buffer'], instance: ['server-1'] },
  up: { instance: ['server-1', 'server-2'], job: ['node-exporter'] },
  http_requests_total: { method: ['GET', 'POST'], status: ['200', '500'], endpoint: ['/api', '/health'], instance: ['server-1'], job: ['api'] },
};

export function createMockQueryService(): QueryService {
  return {
    async executeQueries(queries: CanonicalQuery[], context: QueryContext): Promise<QueryResult[]> {
      const { timeRange } = context;
      const from = typeof timeRange.from === 'number' ? timeRange.from : Date.now() - 60 * 60 * 1000;
      const to = typeof timeRange.to === 'number' ? timeRange.to : Date.now();

      return queries.map((q) => {
        const data: TimeSeriesData[] = getDefaultDataByExpr(q.expr);
        return {
          queryId: q.id,
          refId: q.refId,
          expr: q.expr,
          data,
          error: undefined,
          loading: false,
          meta: { from, to },
        };
      });
    },

    async fetchMetrics(search?: string): Promise<string[]> {
      if (!search) return mockMetrics.slice(0, 10);
      const lower = search.toLowerCase();
      return mockMetrics.filter((m) => m.toLowerCase().includes(lower));
    },

    async fetchLabelKeys(metric: string): Promise<string[]> {
      return mockLabelKeys[metric] ?? ['instance', 'job'];
    },

    async fetchLabelValues(metric: string, labelKey: string): Promise<string[]> {
      return mockLabelValues[metric]?.[labelKey] ?? ['value1', 'value2', 'value3'];
    },

    async fetchVariableValues(expr: string): Promise<Array<{ text: string; value: string }>> {
      const metric = expr.trim();
      const values = (mockLabelValues[metric]?.instance ?? ['server-1', 'server-2']).map((v) => ({ text: v, value: v }));
      return values;
    },
  };
}
