/**
 * 查询 Mock 数据和执行器
 */

import type { Query, QueryResult, TimeRange, TimeSeriesData } from '@/types';
import {
  generateCPUUsageData,
  generateMemoryUsageData,
  generateNetworkTrafficData,
  generateDiskUsageData,
  generateTimeSeriesData,
} from './timeSeriesData';
import { parseTimeRange } from '@/utils/time';

/**
 * 执行查询（模拟）
 */
export async function executeQuery(query: Query, timeRange: TimeRange): Promise<QueryResult> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

  const absoluteTimeRange = parseTimeRange(timeRange);
  const step = query.minStep ? query.minStep * 1000 : 15000; // 默认 15 秒

  let data: TimeSeriesData[] = [];

  try {
    // 根据查询表达式生成不同的数据
    const expr = query.expr.toLowerCase();

    if (expr.includes('cpu') || expr.includes('processor')) {
      data = generateCPUUsageData(absoluteTimeRange);
    } else if (expr.includes('memory') || expr.includes('mem')) {
      data = generateMemoryUsageData(absoluteTimeRange);
    } else if (expr.includes('network') || expr.includes('traffic') || expr.includes('bytes')) {
      data = generateNetworkTrafficData(absoluteTimeRange);
    } else if (expr.includes('disk') || expr.includes('storage')) {
      data = generateDiskUsageData(absoluteTimeRange);
    } else {
      // 默认生成单条时间序列
      data = [
        generateTimeSeriesData(
          {
            __name__: 'metric',
            job: 'default',
          },
          absoluteTimeRange,
          step
        ),
      ];
    }

    // 应用图例格式
    if (query.legendFormat) {
      data = data.map((series) => ({
        ...series,
        metric: {
          ...series.metric,
          __legend__: formatLegend(query.legendFormat!, series.metric),
        },
      }));
    }

    return {
      queryId: query.id,
      expr: query.expr,
      data,
      loading: false,
    };
  } catch (error) {
    return {
      queryId: query.id,
      expr: query.expr,
      data: [],
      error: error instanceof Error ? error.message : '查询执行失败',
      loading: false,
    };
  }
}

/**
 * 执行多个查询
 */
export async function executeQueries(queries: Query[], timeRange: TimeRange): Promise<QueryResult[]> {
  return Promise.all(queries.map((query) => executeQuery(query, timeRange)));
}

/**
 * 格式化图例
 */
function formatLegend(template: string, metric: Record<string, string>): string {
  let result = template;

  // 替换 {{label}} 格式
  Object.entries(metric).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });

  return result;
}
