/**
 * 时间序列数据生成工具
 * 注意：这里不再生成随机数据，让 queries.ts 使用默认数据池
 */

import type { TimeSeriesData, KeyValue, Timestamp } from '@/types';

/**
 * 生成时间序列数据
 * 返回空数据，让 queries.ts 使用默认数据池
 */
export function generateTimeSeriesData(query: string, _from: Timestamp, _to: Timestamp, _step?: number): TimeSeriesData[] {
  // 不再生成随机数据，返回空数组
  // 这样 queries.ts 会使用默认数据池
  console.log(`generateTimeSeriesData called for query: ${query}, returning empty array to use default data pool`);
  return [];
}

/**
 * 生成多条时间序列数据
 */
export function generateMultipleTimeSeries(
  metrics: KeyValue[],
  timeRange: { from: Timestamp; to: Timestamp },
  step: number = 15000
): TimeSeriesData[] {
  return metrics
    .map((metric) => {
      // 将 KeyValue 转换为查询字符串（仅用于兼容性，实际不会使用）
      const queryStr = JSON.stringify(metric);
      return generateTimeSeriesData(queryStr, timeRange.from, timeRange.to, step);
    })
    .flat();
}

/**
 * 生成 CPU 使用率数据
 */
export function generateCPUUsageData(timeRange: { from: Timestamp; to: Timestamp }, cpuCount: number = 4): TimeSeriesData[] {
  const metrics: KeyValue[] = [];
  for (let i = 0; i < cpuCount; i++) {
    metrics.push({
      __name__: 'cpu_usage',
      cpu: `cpu${i}`,
      instance: 'localhost:9100',
    });
  }
  return generateMultipleTimeSeries(metrics, timeRange);
}

/**
 * 生成内存使用率数据
 */
export function generateMemoryUsageData(timeRange: { from: Timestamp; to: Timestamp }): TimeSeriesData[] {
  const metrics: KeyValue[] = [
    {
      __name__: 'memory_usage',
      type: 'used',
      instance: 'localhost:9100',
    },
    {
      __name__: 'memory_usage',
      type: 'cached',
      instance: 'localhost:9100',
    },
    {
      __name__: 'memory_usage',
      type: 'free',
      instance: 'localhost:9100',
    },
  ];
  return generateMultipleTimeSeries(metrics, timeRange);
}

/**
 * 生成网络流量数据
 */
export function generateNetworkTrafficData(timeRange: { from: Timestamp; to: Timestamp }): TimeSeriesData[] {
  const metrics: KeyValue[] = [
    {
      __name__: 'network_traffic',
      direction: 'in',
      interface: 'eth0',
    },
    {
      __name__: 'network_traffic',
      direction: 'out',
      interface: 'eth0',
    },
  ];
  return generateMultipleTimeSeries(metrics, timeRange);
}

/**
 * 生成磁盘使用率数据
 */
export function generateDiskUsageData(timeRange: { from: Timestamp; to: Timestamp }): TimeSeriesData[] {
  const metrics: KeyValue[] = [
    {
      __name__: 'disk_usage',
      mount: '/',
      device: '/dev/sda1',
    },
    {
      __name__: 'disk_usage',
      mount: '/home',
      device: '/dev/sda2',
    },
  ];
  return generateMultipleTimeSeries(metrics, timeRange);
}
