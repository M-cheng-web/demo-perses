/**
 * PromQL QueryBuilder：内部共享类型
 *
 * 维护策略：
 * - “类型”是跨包共享的契约，应以 `@grafana-fast/types` 为唯一来源
 * - utils/promql 只维护渲染/操作/建模逻辑，不再重复定义同名类型
 */

import type { QueryBuilderOperation } from '@grafana-fast/types';

export type {
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  VisualQueryBinary,
  VisualQueryModeller,
  PromVisualQuery as PrometheusVisualQuery,
} from '@grafana-fast/types';

/**
 * 仅用于泛型约束：包含 operations 字段的查询结构
 */
export interface QueryWithOperations {
  operations: QueryBuilderOperation[];
}
