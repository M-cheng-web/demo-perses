/**
 * mock QueryService
 *
 * 说明：
 * - 用内置数据池（defaultDataPool.ts）模拟 Prometheus 查询结果
 * - 同时提供 QueryBuilder 所需的 metrics/labels/value 列表能力
 */
import type { QueryService } from '../../contracts';
import type { CanonicalQuery, QueryContext, QueryResult, TimeRange, TimeSeriesData } from '@grafana-fast/types';
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
  up: ['job', 'instance', 'cluster', 'namespace'],
  cpu_usage: ['cpu', 'instance', 'cluster', 'namespace', 'service'],
  memory_usage: ['type', 'instance', 'cluster', 'namespace', 'service'],
  http_requests_total: ['method', 'status', 'endpoint', 'instance', 'job', 'cluster', 'namespace'],
};

const mockLabelValues: Record<string, Record<string, string[]>> = {
  cpu_usage: {
    cpu: ['0', '1', '2', '3'],
    instance: ['server-1', 'server-2'],
    cluster: ['prod-a', 'prod-b', 'staging'],
    namespace: ['default', 'kube-system', 'monitoring'],
    service: ['api', 'web', 'gateway'],
  },
  memory_usage: {
    type: ['used', 'cached', 'buffer'],
    instance: ['server-1', 'server-2'],
    cluster: ['prod-a', 'prod-b'],
    namespace: ['default', 'kube-system', 'monitoring'],
    service: ['api', 'web', 'gateway'],
  },
  up: {
    instance: ['server-1', 'server-2'],
    job: ['node-exporter'],
    cluster: ['prod-a', 'prod-b', 'staging'],
    namespace: ['default', 'kube-system', 'monitoring'],
  },
  http_requests_total: {
    method: ['GET', 'POST'],
    status: ['200', '500'],
    endpoint: ['/api', '/health'],
    instance: ['server-1', 'server-2'],
    job: ['api', 'web', 'gateway'],
    cluster: ['prod-a', 'prod-b', 'staging'],
    namespace: ['default', 'kube-system', 'monitoring'],
  },
};

function parseLabelValuesExpr(expr: string): { metric: string; label: string } | null {
  // Support a tiny subset of Grafana-like variable queries:
  // - label_values(metric, label)
  // - label_values(metric{...}, label)  (selectors are ignored in mock)
  const text = String(expr ?? '').trim();
  const m = text.match(/label_values\s*\(\s*([A-Za-z_:][A-Za-z0-9_:]*)(?:\s*\{[^}]*\})?\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/);
  if (!m) return null;
  return { metric: m[1]!, label: m[2]! };
}

function getMockLabelValues(metric: string, labelKey: string): string[] {
  return mockLabelValues[metric]?.[labelKey] ?? ['value1', 'value2', 'value3'];
}

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
      return getMockLabelValues(metric, labelKey);
    },

    async fetchVariableValues(expr: string, _timeRange: TimeRange): Promise<Array<{ text: string; value: string }>> {
      const text = String(expr ?? '').trim();
      const parsed = parseLabelValuesExpr(text);
      if (parsed) {
        const values = getMockLabelValues(parsed.metric, parsed.label);
        return values.map((v) => ({ text: v, value: v }));
      }

      // Fallback: treat expr as a metric name and return its instance values (legacy behavior).
      const metric = text;
      const values = getMockLabelValues(metric, 'instance');
      return values.map((v) => ({ text: v, value: v }));
    },
  };
}
