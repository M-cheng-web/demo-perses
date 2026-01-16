/**
 * 默认数据池（mock 查询数据）
 *
 * 说明：
 * - mock QueryService 会根据 expr 的关键字从这里取数据
 * - 这里的数据用于演示/回归验证：确保图表能稳定渲染、Tooltip/Legend 等交互可测试
 *
 * 注意：
 * - 这是 mock 层的实现细节，不属于 contracts；后续可自由调整数据形态
 */
import type { TimeSeriesData } from '@grafana-fast/types';

type DataPoint = [number, number];

function generateTimeSeriesValues(startTime: number, count: number, interval: number, baseValue: number, variance: number, trend: number = 0): DataPoint[] {
  const values: DataPoint[] = [];
  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * interval;
    const trendValue = baseValue + trend * i;
    const randomVariance = (Math.random() - 0.5) * variance * 2;
    const value = Math.max(0, trendValue + randomVariance);
    values.push([timestamp, Number(value.toFixed(2))]);
  }
  return values;
}

function getDefaultTimeRange(): { start: number; end: number; interval: number; count: number } {
  const end = Date.now();
  const start = end - 3 * 60 * 60 * 1000;
  const interval = 3 * 60 * 1000;
  const count = 60;
  return { start, end, interval, count };
}

const DEFAULT_DATA_POOL: Record<string, () => TimeSeriesData[]> = {
  cpu_usage: () => {
    const { start, interval, count } = getDefaultTimeRange();
    return [
      { metric: { __name__: 'cpu_usage', __legend__: 'CPU Core 1', cpu: '1', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 35, 8, 0.05) },
      { metric: { __name__: 'cpu_usage', __legend__: 'CPU Core 2', cpu: '2', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 42, 10, 0.08) },
      { metric: { __name__: 'cpu_usage', __legend__: 'CPU Core 3', cpu: '3', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 28, 7, 0.02) },
      { metric: { __name__: 'cpu_usage', __legend__: 'CPU Core 4', cpu: '4', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 38, 9, 0.03) },
    ];
  },
  avg_cpu_usage: () => {
    const { start, interval, count } = getDefaultTimeRange();
    return [{ metric: { __name__: 'cpu_usage', __legend__: '平均 CPU 使用率' }, values: generateTimeSeriesValues(start, count, interval, 36, 3.5, 0.03) }];
  },
  max_cpu_usage: () => {
    const { start, interval, count } = getDefaultTimeRange();
    return [{ metric: { __name__: 'cpu_usage', __legend__: '最大 CPU 使用率' }, values: generateTimeSeriesValues(start, count, interval, 54, 7.5, 0.05) }];
  },
  memory_usage: () => {
    const { start, interval, count } = getDefaultTimeRange();
    return [
      { metric: { __name__: 'memory_usage', __legend__: 'used', type: 'used', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 12.5, 0.8, 0.015) },
      { metric: { __name__: 'memory_usage', __legend__: 'cached', type: 'cached', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 3.2, 0.3, 0.005) },
    ];
  },
  up: () => {
    const { start, interval, count } = getDefaultTimeRange();
    return [
      { metric: { __name__: 'up', __legend__: 'server-1', instance: 'server-1' }, values: generateTimeSeriesValues(start, count, interval, 1, 0.1, 0) },
      { metric: { __name__: 'up', __legend__: 'server-2', instance: 'server-2' }, values: generateTimeSeriesValues(start, count, interval, 1, 0.1, 0) },
    ];
  },
};

export function getDefaultDataByExpr(expr: string): TimeSeriesData[] {
  const normalized = String(expr ?? '').trim();
  // A few common aggregate wrappers used in demo dashboards.
  if (normalized.includes('avg(') && normalized.includes('cpu_usage')) return DEFAULT_DATA_POOL.avg_cpu_usage();
  if (normalized.includes('max(') && normalized.includes('cpu_usage')) return DEFAULT_DATA_POOL.max_cpu_usage();

  const key = Object.keys(DEFAULT_DATA_POOL).find((k) => normalized.includes(k));
  const generator = key ? DEFAULT_DATA_POOL[key] : undefined;
  if (!generator) return [];
  return generator();
}
