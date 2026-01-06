/**
 * @fileoverview 查询构建器内部共享类型
 * @description
 *   定义查询构建器内部使用的共享类型和接口。
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/shared/types.ts
 */
/**
 * Shared types that can be reused
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/shared/types.ts
 */

// 标签过滤器
export interface QueryBuilderLabelFilter {
  label: string;
  op: string;
  value: string;
}

// 操作
export interface QueryBuilderOperation {
  id: string;
  params: QueryBuilderOperationParamValue[];
}

// 带操作的查询
export interface QueryWithOperations {
  operations: QueryBuilderOperation[];
}

// 操作定义
export interface QueryBuilderOperationDef<T = any> {
  id: string;
  name: string;
  documentation?: string;
  params: QueryBuilderOperationParamDef[];
  defaultParams: QueryBuilderOperationParamValue[];
  category: string;
  hideFromList?: boolean;
  alternativesKey?: string;
  orderRank?: number;
  renderer: QueryBuilderOperationRenderer;
  addOperationHandler: QueryBuilderAddOperationHandler<T>;
  paramChangedHandler?: QueryBuilderOnParamChangedHandler;
  explainHandler?: QueryBuilderExplainOperationHandler;
  changeTypeHandler?: (op: QueryBuilderOperation, newDef: QueryBuilderOperationDef<T>) => QueryBuilderOperation;
}

type QueryBuilderAddOperationHandler<T> = (def: QueryBuilderOperationDef, query: T, modeller: VisualQueryModeller) => T;

type QueryBuilderExplainOperationHandler = (op: QueryBuilderOperation, def?: QueryBuilderOperationDef) => string;

type QueryBuilderOnParamChangedHandler = (
  index: number,
  operation: QueryBuilderOperation,
  operationDef: QueryBuilderOperationDef
) => QueryBuilderOperation;

type QueryBuilderOperationRenderer = (model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) => string;

export type QueryBuilderOperationParamValue = string | number | boolean;

// 操作参数定义
export interface QueryBuilderOperationParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[] | number[] | Array<{ label: string; value: string | number }>;
  hideName?: boolean;
  restParam?: boolean;
  optional?: boolean;
  placeholder?: string;
  description?: string;
  minWidth?: number;
  editor?: string; // 'LabelParamEditor' 等
  runQueryOnEnter?: boolean;
}

// 查询编辑器模式
// @ts-ignore
export enum QueryEditorMode {
  Code = 'code',
  Builder = 'builder',
}

// 可视化查询建模器接口
export interface VisualQueryModeller {
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getAlternativeOperations(key: string): QueryBuilderOperationDef[];
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef | undefined;
}

// 二元查询
export interface VisualQueryBinary<T> {
  operator: string;
  vectorMatchesType?: 'on' | 'ignoring';
  vectorMatches?: string;
  query: T;
}

// Prometheus 可视化查询
export interface PrometheusVisualQuery {
  metric?: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: Array<VisualQueryBinary<PrometheusVisualQuery>>;
}
