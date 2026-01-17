/**
 * PromQL QueryBuilder：操作 ID 生成工具
 *
 * 说明：
 * - QueryBuilder 内部会为聚合操作自动生成 `by/without` 的变体
 * - 这些变体 ID 在多个地方会被引用（例如 QueryPatterns），集中管理可减少魔法字符串
 */

/**
 * 聚合操作的 `by` 变体 ID
 *
 * @example
 * - `aggById('sum')` -> `__sum_by`
 */
export function aggById(baseAggregationId: string): string {
  return `__${baseAggregationId}_by`;
}

/**
 * 聚合操作的 `without` 变体 ID
 *
 * @example
 * - `aggWithoutId('sum')` -> `__sum_without`
 */
export function aggWithoutId(baseAggregationId: string): string {
  return `__${baseAggregationId}_without`;
}

