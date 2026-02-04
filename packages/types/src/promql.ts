/**
 * @deprecated
 *
 * 历史遗留入口：`promql.ts` 早期包含了一套 PromQL/QueryBuilder 相关类型，
 * 但仓库已经把“稳定契约类型”收敛到：
 * - `queryBuilder.ts`（PromVisualQuery / QueryBuilder*）
 * - `prometheus.ts`（PrometheusQueryResult 等）
 *
 * 该文件保留仅作为兼容层：统一 re-export 到新的单一来源，避免类型重复定义与语义漂移。
 */

export type {
  QueryBuilderLabelFilter as LabelFilter,
  QueryBuilderOperation as Operation,
  QueryBuilderOperationParamValue as OperationParamValue,
  QueryBuilderOperationDef as OperationDef,
  QueryBuilderOperationParamDef as OperationParamDef,
  PromVisualQuery,
} from './queryBuilder.js';

export { PromVisualQueryOperationCategory as OperationCategory, QueryEditorMode, PromOperationId } from './queryBuilder.js';

export type { PrometheusQueryResult, PrometheusDataPoint, TimeSeries } from './prometheus.js';
