/**
 * 时间序列数据生成工具
 */

import type { TimeSeriesData, DataPoint, KeyValue, Timestamp } from '@/types';

/**
 * 生成时间序列数据
 */
export function generateTimeSeriesData(
  metric: KeyValue,
  timeRange: { from: Timestamp; to: Timestamp },
  step: number = 15000 // 默认 15 秒
): TimeSeriesData {
  const values: DataPoint[] = [];
  const baseValue = Math.random() * 100;
  const variance = 20;

  for (let ts = timeRange.from; ts <= timeRange.to; ts += step) {
    // 生成带波动的值
    const noise = (Math.random() - 0.5) * variance;
    const trend = Math.sin((ts - timeRange.from) / 1000000) * 10;
    const value = Math.max(0, baseValue + noise + trend);
    values.push([ts, Number(value.toFixed(2))]);
  }

  return { metric, values };
}

/**
 * 生成多条时间序列数据
 */
export function generateMultipleTimeSeries(
  metrics: KeyValue[],
  timeRange: { from: Timestamp; to: Timestamp },
  step: number = 15000
): TimeSeriesData[] {
  return metrics.map((metric) => generateTimeSeriesData(metric, timeRange, step));
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
