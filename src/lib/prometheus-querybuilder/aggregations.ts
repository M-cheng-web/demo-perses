/**
 * @fileoverview 聚合操作定义
 * @description
 *   定义 PromQL 聚合操作及其 by/without 变体。
 *       主要内容：
 *       - 基础聚合: sum, avg, max, min, count, group
 *       - 高级聚合: topk, bottomk, quantile, count_values
 *       - 统计聚合: stddev, stdvar
 *       - 每个聚合都有三个变体：base（无分组）, _by（按标签分组）, _without（排除标签）
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/aggregations.ts
 */
/**
 * 聚合操作定义
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/aggregations.ts
 */
import {
  createAggregationOperation,
  createAggregationOperationWithParam,
  getPromOperationDisplayName,
  getRangeVectorParamDef,
  defaultAddOperationHandler,
} from './operationUtils';
import type { QueryBuilderOperation, QueryBuilderOperationDef } from './shared/types';
import { PromOperationId, PromVisualQueryOperationCategory } from './types';

/**
 * 获取所有聚合操作
 */
export function getAggregationOperations(): QueryBuilderOperationDef[] {
  return [
    ...createAggregationOperation(PromOperationId.Sum),
    ...createAggregationOperation(PromOperationId.Avg),
    ...createAggregationOperation(PromOperationId.Min),
    ...createAggregationOperation(PromOperationId.Max),
    ...createAggregationOperation(PromOperationId.Count),
    ...createAggregationOperation(PromOperationId.Group),
    ...createAggregationOperation(PromOperationId.Stddev),
    ...createAggregationOperation(PromOperationId.Stdvar),
    ...createAggregationOperationWithParam(PromOperationId.TopK, {
      params: [{ name: 'K-value', type: 'number' }],
      defaultParams: [5],
    }),
    ...createAggregationOperationWithParam(PromOperationId.BottomK, {
      params: [{ name: 'K-value', type: 'number' }],
      defaultParams: [5],
    }),
    ...createAggregationOperationWithParam(PromOperationId.CountValues, {
      params: [{ name: 'Identifier', type: 'string' }],
      defaultParams: ['count'],
    }),
    ...createAggregationOperationWithParam(PromOperationId.Quantile, {
      params: [{ name: 'Value', type: 'number' }],
      defaultParams: [0.95],
    }),
    createAggregationOverTime(PromOperationId.SumOverTime),
    createAggregationOverTime(PromOperationId.AvgOverTime),
    createAggregationOverTime(PromOperationId.MinOverTime),
    createAggregationOverTime(PromOperationId.MaxOverTime),
    createAggregationOverTime(PromOperationId.CountOverTime),
    createAggregationOverTime(PromOperationId.LastOverTime),
    createAggregationOverTime(PromOperationId.PresentOverTime),
    createAggregationOverTime(PromOperationId.AbsentOverTime),
    createAggregationOverTime(PromOperationId.StddevOverTime),
  ];
}

/**
 * 创建 over_time 聚合操作
 */
function createAggregationOverTime(name: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromOperationDisplayName(name),
    params: [getRangeVectorParamDef()],
    defaultParams: ['$__interval'],
    alternativesKey: 'overtime function',
    category: PromVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: defaultAddOperationHandler,
    explainHandler: (op) => {
      const range = op.params[0] || '$__interval';
      return `计算时间范围 [${range}] 内的 ${getPromOperationDisplayName(name)}`;
    },
  };
}

/**
 * 带范围向量的操作渲染器
 */
function operationWithRangeVectorRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  const rangeVector = (model.params ?? [])[0] ?? '$__interval';
  return `${def.id}(${innerExpr}[${rangeVector}])`;
}
