/**
 * Prometheus API Mock
 * 返回空数组，让 queries.ts 使用默认数据池
 */

import type { TimeSeriesData } from '@/types';

export interface PrometheusQueryParams {
  query: string;
  start: number;
  end: number;
  step?: number;
}

/**
 * 查询 Prometheus 数据（模拟）
 * 返回空数组，让 queries.ts 使用默认数据池
 */
export async function queryPrometheus(_params: PrometheusQueryParams): Promise<TimeSeriesData[]> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));

  // 返回空数组，让 queries.ts 使用默认数据池
  // 如果你想对接真实的 Prometheus API，在这里实现
  // console.log(`Prometheus API called for query: ${params.query}, returning empty to use default data pool`);

  return [];
}
