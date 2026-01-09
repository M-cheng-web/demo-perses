/**
 * @fileoverview 二元标量操作定义
 * @description
 *   定义 PromQL 二元标量操作（算术和比较运算）。
 *       主要内容：
 *       - 算术运算: Addition(+), Subtraction(-), MultiplyBy(*), DivideBy(/), Modulo(%), Exponent(^)
 *       - 比较运算: EqualTo(==), NotEqualTo(!=), GreaterThan(>), LessThan(<), GreaterOrEqual(>=), LessOrEqual(<=)
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/binaryScalarOperations.ts
 */
/**
 * 二元标量操作定义
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/binaryScalarOperations.ts
 */
import { defaultAddOperationHandler } from './operationUtils';
import type { QueryBuilderOperationDef } from './shared/types';
import { PromOperationId, PromVisualQueryOperationCategory } from './types';

/**
 * 获取二元标量操作定义
 */
export const binaryScalarOperations: QueryBuilderOperationDef[] = [
  // 算术操作
  createBinaryScalarOp({
    id: PromOperationId.Addition,
    sign: '+',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.Subtraction,
    sign: '-',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.MultiplyBy,
    sign: '*',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.DivideBy,
    sign: '/',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.Modulo,
    sign: '%',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.Exponent,
    sign: '^',
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),

  // 比较操作
  createBinaryScalarOp({
    id: PromOperationId.EqualTo,
    sign: '==',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.NotEqualTo,
    sign: '!=',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.GreaterThan,
    sign: '>',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.LessThan,
    sign: '<',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.GreaterOrEqual,
    sign: '>=',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
  createBinaryScalarOp({
    id: PromOperationId.LessOrEqual,
    sign: '<=',
    comparison: true,
    category: PromVisualQueryOperationCategory.BinaryOps,
  }),
];

interface BinaryScalarOpOptions {
  id: string;
  sign: string;
  comparison?: boolean;
  category: string;
}

/**
 * 创建二元标量操作定义
 */
function createBinaryScalarOp(options: BinaryScalarOpOptions): QueryBuilderOperationDef {
  const { id, sign, comparison, category } = options;

  return {
    id,
    name: getOperationName(id, sign),
    params: [
      {
        name: 'Value',
        type: 'number',
        hideName: true,
      },
      ...(comparison
        ? [
            {
              name: 'Bool',
              type: 'boolean' as const,
              hideName: true,
              optional: true,
            },
          ]
        : []),
    ],
    defaultParams: [2, ...(comparison ? [false] : [])],
    alternativesKey: 'binary scalar operations',
    category,
    renderer: (model, _def, innerExpr) => {
      const params = model.params;
      let result = `${innerExpr} ${sign} ${params[0]}`;

      // 如果是比较操作并且 bool 参数为 true
      if (comparison && params[1] === true) {
        result += ' bool';
      }

      return result;
    },
    addOperationHandler: defaultAddOperationHandler,
    explainHandler: (op) => {
      const value = op.params[0];
      const explanations: Record<string, string> = {
        [PromOperationId.Addition]: `对每个数据点加 ${value}`,
        [PromOperationId.Subtraction]: `对每个数据点减 ${value}`,
        [PromOperationId.MultiplyBy]: `对每个数据点乘以 ${value}`,
        [PromOperationId.DivideBy]: `对每个数据点除以 ${value}`,
        [PromOperationId.Modulo]: `对每个数据点取模 ${value}`,
        [PromOperationId.Exponent]: `对每个数据点求 ${value} 次幂`,
        [PromOperationId.EqualTo]: `保留等于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
        [PromOperationId.NotEqualTo]: `保留不等于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
        [PromOperationId.GreaterThan]: `保留大于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
        [PromOperationId.LessThan]: `保留小于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
        [PromOperationId.GreaterOrEqual]: `保留大于等于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
        [PromOperationId.LessOrEqual]: `保留小于等于 ${value} 的数据点${op.params[1] ? '（返回 0 或 1）' : ''}`,
      };
      return explanations[id] || `应用 ${sign} 操作`;
    },
  };
}

/**
 * 获取操作显示名称
 */
function getOperationName(id: string, sign: string): string {
  const names: Record<string, string> = {
    [PromOperationId.Addition]: `+ 加法`,
    [PromOperationId.Subtraction]: `- 减法`,
    [PromOperationId.MultiplyBy]: `× 乘法`,
    [PromOperationId.DivideBy]: `÷ 除法`,
    [PromOperationId.Modulo]: `% 取模`,
    [PromOperationId.Exponent]: `^ 指数`,
    [PromOperationId.EqualTo]: `== 等于`,
    [PromOperationId.NotEqualTo]: `!= 不等于`,
    [PromOperationId.GreaterThan]: `> 大于`,
    [PromOperationId.LessThan]: `< 小于`,
    [PromOperationId.GreaterOrEqual]: `>= 大于等于`,
    [PromOperationId.LessOrEqual]: `<= 小于等于`,
  };
  return names[id] || sign;
}
