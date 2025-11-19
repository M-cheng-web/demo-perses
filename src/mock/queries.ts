/**
 * 查询执行 Mock - 直接返回假数据
 * 使用默认数据池
 */

import type { Query, QueryResult, TimeSeriesData } from '@/types';
import { getDefaultDataByExpr } from './defaultDataPool';

/**
 * 执行单个查询
 */
export async function executeQuery(query: Query, _timeRange: { from: number; to: number }): Promise<QueryResult> {
  // 直接使用默认数据池返回假数据
  const data: TimeSeriesData[] = getDefaultDataByExpr(query.expr);

  const result: QueryResult = {
    queryId: query.id,
    expr: query.expr,
    data,
    error: undefined,
    loading: false,
  };

  return result;
}

/**
 * 执行多个查询
 */
export async function executeQueries(queries: Query[], timeRange: { from: number; to: number }): Promise<QueryResult[]> {
  const promises = queries.map((query) => executeQuery(query, timeRange));
  return Promise.all(promises);
}

/**
 * 清理过期的查询缓存（仅用于兼容性，不实际执行）
 */
export function cleanExpiredQueryCache(): void {
  // 不进行任何操作，仅用于兼容性
  console.log('cleanExpiredQueryCache called (no-op in mock mode)');
}

/**
 * 清空所有查询缓存（仅用于兼容性，不实际执行）
 */
export function clearAllQueryCache(): void {
  // 不进行任何操作，仅用于兼容性
  console.log('clearAllQueryCache called (no-op in mock mode)');
}
