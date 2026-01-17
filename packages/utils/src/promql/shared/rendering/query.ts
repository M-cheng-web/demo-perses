/**
 * @fileoverview PromQL 查询渲染逻辑
 * @description
 *   将 PromVisualQuery 对象渲染为完整的 PromQL 字符串。
 *       主要功能：
 *       - renderQuery: 主渲染函数（处理 metric、labels、operations、binaryQueries）
 *       - 处理嵌套查询的递归渲染
 *       - 处理二元操作符和 vector matching
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/shared/parsingUtils.ts
 */
/**
 * 查询渲染逻辑
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/shared/rendering/query.ts
 */
import type { PrometheusVisualQuery, QueryBuilderOperationDef, VisualQueryBinary } from '../types';
import { renderLabels } from './labels';
import { hasBinaryOp, renderOperations } from './operations';

/**
 * 渲染完整查询
 */
export function renderQuery(
  query: PrometheusVisualQuery,
  nested: boolean = false,
  operationsRegistry?: Map<string, QueryBuilderOperationDef>
): string {
  // 处理空查询
  if (!query.metric && query.labels.length === 0 && query.operations.length === 0) {
    return '';
  }

  let queryString = '';
  const labels = renderLabels(query.labels);

  // 构建基础查询（指标 + 标签）
  if (query.metric) {
    queryString = `${query.metric}${labels}`;
  } else if (query.labels.length > 0) {
    // 只有标签没有指标
    queryString = labels;
  } else if (query.operations.length > 0) {
    // 对于查询模式，我们希望操作渲染为 e.g. rate([$__rate_interval])
    queryString = '';
  }

  // 如果有操作和操作注册表，渲染操作
  if (query.operations.length > 0) {
    if (operationsRegistry) {
      queryString = renderOperations(queryString, query.operations, operationsRegistry);
    }
  }

  // 检查此查询或子查询是否需要括号
  const hasNesting = Boolean(query.binaryQueries?.length);
  const hasBinaryOperation = operationsRegistry ? hasBinaryOp(query, operationsRegistry) : false;

  // 处理带有二元操作的嵌套查询
  if (!nested && hasBinaryOperation && hasNesting) {
    queryString = `(${queryString})`;
  }

  // 渲染任何二元查询
  if (hasNesting) {
    for (const binQuery of query.binaryQueries!) {
      const rightOperand = renderNestedPart(binQuery.query, operationsRegistry);

      // 如果存在，添加向量匹配
      const vectorMatchingStr = renderVectorMatching(binQuery);

      // 组合左右操作数与操作符
      queryString = `${queryString} ${binQuery.operator} ${vectorMatchingStr}${rightOperand}`;
    }
  }

  // 为需要时的嵌套查询添加括号
  if (nested && (hasBinaryOperation || hasNesting)) {
    queryString = `(${queryString})`;
  }

  return queryString;
}

/**
 * 渲染二元查询的嵌套部分的特殊辅助函数
 * 这确保我们只在需要时添加括号
 */
function renderNestedPart(query: PrometheusVisualQuery, operationsRegistry?: Map<string, QueryBuilderOperationDef>): string {
  // 首先渲染查询本身
  const renderedQuery = renderQuery(query, false, operationsRegistry);

  const hasOps = query.operations.length > 0;
  const hasNestedBinary = Boolean(query.binaryQueries?.length);

  // 如果这是一个仅操作查询（没有指标、没有标签、没有 binaryQueries，至少一个操作），不添加括号
  if (hasOps && !hasNestedBinary && !query.metric && (!query.labels || query.labels.length === 0)) {
    return renderedQuery;
  }

  // 保持测试期望的正确格式
  if (hasOps || hasNestedBinary) {
    return `(${renderedQuery})`;
  }

  return renderedQuery;
}

/**
 * 渲染二元查询
 */
export function renderBinaryQueries(
  queryString: string,
  binaryQueries?: Array<VisualQueryBinary<PrometheusVisualQuery>>,
  operationsRegistry?: Map<string, QueryBuilderOperationDef>
): string {
  if (binaryQueries) {
    for (const binQuery of binaryQueries) {
      queryString = `${renderBinaryQuery(queryString, binQuery, operationsRegistry)}`;
    }
  }
  return queryString;
}

/**
 * 渲染单个二元查询
 */
function renderBinaryQuery(
  leftOperand: string,
  binaryQuery: VisualQueryBinary<PrometheusVisualQuery>,
  operationsRegistry?: Map<string, QueryBuilderOperationDef>
): string {
  let result = leftOperand + ` ${binaryQuery.operator} `;

  result += renderVectorMatching(binaryQuery);

  return result + renderNestedPart(binaryQuery.query, operationsRegistry);
}

type VectorMatching = {
  type: 'on' | 'ignoring';
  labels: string[];
};

function normalizeLabelList(values: string[]): string[] {
  return (values ?? []).map((v) => String(v).trim()).filter((v) => v.length > 0);
}

function renderVectorMatching(binary: { vectorMatching?: VectorMatching }): string {
  if (binary.vectorMatching) {
    const labels = normalizeLabelList(binary.vectorMatching.labels);
    if (!binary.vectorMatching.type || labels.length === 0) return '';
    return `${binary.vectorMatching.type}(${labels.join(', ')}) `;
  }

  return '';
}
