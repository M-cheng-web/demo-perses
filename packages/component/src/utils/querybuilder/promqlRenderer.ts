/**
 * PromQL 渲染器
 * 将可视化查询模型转换为 PromQL 字符串
 */
import type { PromVisualQuery, LabelFilter, Operation } from '#/types/promql';
import { getOperationById } from './operations';

/**
 * 渲染标签过滤器
 */
export function renderLabels(labels: LabelFilter[]): string {
  if (labels.length === 0) {
    return '';
  }

  const labelStrings = labels.map((label) => {
    return `${label.label}${label.op}"${label.value}"`;
  });

  return `{${labelStrings.join(', ')}}`;
}

/**
 * 渲染单个操作
 */
function renderOperation(operation: Operation, innerExpr: string): string {
  const opDef = getOperationById(operation.id);

  if (!opDef) {
    console.warn(`Unknown operation: ${operation.id}`);
    return innerExpr;
  }

  const { id, params } = operation;

  // 处理范围函数（需要在表达式后添加时间范围）
  if (id === 'rate' || id === 'irate' || id === 'increase') {
    const range = params[0] || '5m';
    return `${id}(${innerExpr}[${range}])`;
  }

  // 处理 _over_time 系列函数
  if (id.endsWith('_over_time')) {
    const range = params[0] || '5m';
    return `${id}(${innerExpr}[${range}])`;
  }

  // 处理聚合操作（带 by 子句）
  if (id.endsWith('_by')) {
    const baseFunc = id.replace('_by', '');
    const labels = params[0] as string;
    if (labels && labels.trim()) {
      const labelList = labels
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l);
      return `${baseFunc} by(${labelList.join(', ')})(${innerExpr})`;
    }
    return `${baseFunc}(${innerExpr})`;
  }

  // 处理简单聚合操作
  if (['sum', 'avg', 'max', 'min', 'count'].includes(id)) {
    return `${id}(${innerExpr})`;
  }

  // 处理 topk/bottomk
  if (id === 'topk' || id === 'bottomk') {
    const k = params[0] || 5;
    return `${id}(${k}, ${innerExpr})`;
  }

  // 处理带参数的函数
  if (['clamp_max', 'clamp_min'].includes(id)) {
    const value = params[0];
    return `${id}(${innerExpr}, ${value})`;
  }

  // 处理 round
  if (id === 'round') {
    if (params.length > 0 && params[0] !== undefined) {
      return `${id}(${innerExpr}, ${params[0]})`;
    }
    return `${id}(${innerExpr})`;
  }

  // 处理无参数函数
  if (['abs', 'ceil', 'floor'].includes(id)) {
    return `${id}(${innerExpr})`;
  }

  return innerExpr;
}

/**
 * 渲染完整的 PromQL 查询
 */
export function renderQuery(query: PromVisualQuery): string {
  // 处理空查询
  if (!query.metric && query.labels.length === 0 && query.operations.length === 0) {
    return '';
  }

  let queryString = '';

  // 1. 构建基础查询（指标 + 标签）
  if (query.metric) {
    const labels = renderLabels(query.labels);
    queryString = `${query.metric}${labels}`;
  } else if (query.labels.length > 0) {
    // 只有标签没有指标
    queryString = renderLabels(query.labels);
  }

  // 2. 应用操作
  for (const operation of query.operations) {
    queryString = renderOperation(operation, queryString);
  }

  return queryString;
}

/**
 * 验证 PromQL 查询
 */
export function validateQuery(query: PromVisualQuery): string[] {
  const errors: string[] = [];

  // 检查是否有指标或标签
  if (!query.metric && query.labels.length === 0) {
    errors.push('请至少选择一个指标或添加标签过滤器');
  }

  // 检查标签过滤器
  for (const label of query.labels) {
    if (!label.label) {
      errors.push('标签名不能为空');
    }
    if (!label.value) {
      errors.push(`标签 "${label.label}" 的值不能为空`);
    }
  }

  // 检查操作参数
  for (const operation of query.operations) {
    const opDef = getOperationById(operation.id);
    if (!opDef) {
      continue;
    }

    for (let i = 0; i < opDef.params.length; i++) {
      const paramDef = opDef.params[i];
      const paramValue = operation.params[i];

      if (!paramDef?.optional && (paramValue === undefined || paramValue === '')) {
        errors.push(`操作 "${opDef.name}" 的参数 "${paramDef?.name}" 不能为空`);
      }
    }
  }

  return errors;
}

/**
 * 验证 PromQL 字符串语法（简单验证）
 */
export function validatePromQLString(promql: string): string[] {
  const errors: string[] = [];

  if (!promql || !promql.trim()) {
    errors.push('PromQL 查询不能为空');
    return errors;
  }

  // 检查括号匹配
  let openParens = 0;
  let openBraces = 0;
  let openBrackets = 0;

  for (const char of promql) {
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;

    if (openParens < 0 || openBraces < 0 || openBrackets < 0) {
      errors.push('括号不匹配');
      break;
    }
  }

  if (openParens !== 0) {
    errors.push('圆括号 () 不匹配');
  }
  if (openBraces !== 0) {
    errors.push('花括号 {} 不匹配');
  }
  if (openBrackets !== 0) {
    errors.push('方括号 [] 不匹配');
  }

  return errors;
}
