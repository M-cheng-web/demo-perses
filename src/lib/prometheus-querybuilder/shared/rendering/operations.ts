/**
 * @fileoverview PromQL 操作渲染逻辑
 * @description
 *   渲染查询操作为 PromQL 片段。
 *       主要功能：
 *       - renderOperations: 渲染操作列表
 *       - hasBinaryOp: 检测是否包含二元操作
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/shared/operationUtils.ts
 */
/**
 * 操作渲染逻辑
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/shared/rendering/operations.ts
 */
import { PromVisualQueryOperationCategory } from '../../types';
import type { PrometheusVisualQuery, QueryBuilderOperation, QueryBuilderOperationDef } from '../types';

/**
 * 渲染操作列表
 */
export function renderOperations(
  queryString: string,
  operations: QueryBuilderOperation[],
  operationsRegistry: Map<string, QueryBuilderOperationDef>
): string {
  for (const operation of operations) {
    const def = operationsRegistry.get(operation.id);
    if (!def) {
      throw new Error(`Could not find operation ${operation.id} in the registry`);
    }
    queryString = def.renderer(operation, def, queryString);
  }

  return queryString;
}

/**
 * 检查查询是否有二元操作
 */
export function hasBinaryOp(query: PrometheusVisualQuery, operationsRegistry: Map<string, QueryBuilderOperationDef>): boolean {
  for (const op of query.operations) {
    const def = operationsRegistry.get(op.id);
    if (def?.category === PromVisualQueryOperationCategory.BinaryOps) {
      return true;
    }
  }
  return false;
}
