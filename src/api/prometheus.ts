import type { TimeSeriesData } from '@/types';
import { generateMultipleTimeSeries } from '@/mock/timeSeriesData';

export interface PrometheusQueryParams {
  query: string;
  start: number;
  end: number;
  step?: number;
}

export interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
}

/**
 * 根据查询生成 Mock 指标数据
 */
function generateMockMetrics(query: string): Array<Record<string, string>> {
  // 简单解析查询来生成不同的指标
  const metrics: Array<Record<string, string>> = [];

  if (query.includes('cpu')) {
    metrics.push(
      { __name__: 'cpu_usage', cpu: 'cpu0', instance: 'localhost:9100' },
      { __name__: 'cpu_usage', cpu: 'cpu1', instance: 'localhost:9100' }
    );
  } else if (query === 'memory_apps') {
    metrics.push({ __name__: 'memory_apps', type: 'apps', instance: 'localhost:9100' });
  } else if (query === 'memory_pagetables') {
    metrics.push({ __name__: 'memory_pagetables', type: 'pagetables', instance: 'localhost:9100' });
  } else if (query === 'memory_swapcache') {
    metrics.push({ __name__: 'memory_swapcache', type: 'swapcache', instance: 'localhost:9100' });
  } else if (query === 'memory_slab') {
    metrics.push({ __name__: 'memory_slab', type: 'slab', instance: 'localhost:9100' });
  } else if (query === 'memory_cache') {
    metrics.push({ __name__: 'memory_cache', type: 'cache', instance: 'localhost:9100' });
  } else if (query === 'memory_buffers') {
    metrics.push({ __name__: 'memory_buffers', type: 'buffers', instance: 'localhost:9100' });
  } else if (query.includes('memory')) {
    metrics.push(
      { __name__: 'memory_usage', type: 'used', instance: 'localhost:9100' },
      { __name__: 'memory_usage', type: 'cached', instance: 'localhost:9100' }
    );
  } else if (query.includes('disk')) {
    metrics.push({ __name__: 'disk_usage', mount: '/', device: '/dev/sda1' });
  } else if (query.includes('network')) {
    metrics.push(
      { __name__: 'network_traffic', direction: 'in', interface: 'eth0' },
      { __name__: 'network_traffic', direction: 'out', interface: 'eth0' }
    );
  } else {
    // 默认返回一些通用指标
    metrics.push({ __name__: 'metric', instance: 'localhost:9090', job: 'prometheus' });
  }

  return metrics;
}

/**
 * 查询 Prometheus 数据（Mock 实现）
 */
export async function queryPrometheus(params: PrometheusQueryParams): Promise<TimeSeriesData[]> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 100));

  // 生成 Mock 指标
  const metrics = generateMockMetrics(params.query);

  // 生成时间序列数据
  const timeRange = {
    from: params.start,
    to: params.end,
  };

  const step = params.step ? params.step * 1000 : 15000; // 转换为毫秒
  const mockData = generateMultipleTimeSeries(metrics, timeRange, step);

  return mockData;
}

/**
 * 查询 Prometheus 即时数据（Mock 实现）
 */
export async function queryPrometheusInstant(query: string): Promise<TimeSeriesData[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const now = Date.now();
  const metrics = generateMockMetrics(query);
  const timeRange = { from: now - 1000, to: now };
  const mockData = generateMultipleTimeSeries(metrics, timeRange, 1000);

  return mockData;
}

/**
 * 获取标签值列表（Mock 实现）
 */
export async function getLabelValues(label: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 返回 Mock 标签值
  const mockLabels: Record<string, string[]> = {
    instance: ['localhost:9090', 'localhost:9091', 'localhost:9092'],
    job: ['prometheus', 'node-exporter', 'cadvisor'],
    __name__: ['up', 'cpu_usage', 'memory_usage', 'disk_usage', 'network_traffic'],
  };

  return mockLabels[label] || [];
}

/**
 * 获取指标名称列表（Mock 实现）
 */
export async function getMetricNames(): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  return ['up', 'cpu_usage', 'memory_usage', 'disk_usage', 'network_traffic', 'http_requests_total', 'http_request_duration_seconds'];
}
