/**
 * @fileoverview PromQL 操作定义注册表
 * @description
 *   定义所有 PromQL 操作的完整配置。
 *       主要内容：
 *       - 范围函数: rate, irate, increase, delta, idelta, deriv, changes, resets 等
 *       - 聚合函数: sum, avg, max, min, count, topk, bottomk, quantile 等（含 by/without 变体）
 *       - 数学函数: abs, ceil, floor, sqrt, exp, ln, log2, log10, round 等
 *       - 三角函数: sin, cos, tan, asin, acos, atan 及其双曲函数
 *       - 时间函数: hour, minute, day_of_week, day_of_month, month, year 等
 *       - 直方图函数: histogram_quantile, histogram_avg 等
 *       - 标签函数: label_replace, label_join
 *       - 二元操作: 算术运算、比较运算、嵌套查询
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/operations.ts
 */
/**
 * 其他操作定义（范围函数、通用函数等）
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/operations.ts
 */
import { binaryScalarOperations } from './binaryScalarOperations';
import {
  functionRendererLeft,
  functionRendererRight,
  getPromOperationDisplayName,
  getRangeVectorParamDef,
  defaultAddOperationHandler,
  rangeRendererLeftWithParams,
  rangeRendererRightWithParams,
  addNestedQueryHandler,
} from './operationUtils';
import type { QueryBuilderOperation, QueryBuilderOperationDef, VisualQueryModeller } from './shared/types';
import { PromOperationId, PromVisualQueryOperationCategory } from './types';
import type { PromVisualQuery } from './types';
import { quotePromqlString } from './shared/rendering/escape';

export function getOperationDefinitions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    // Histogram 函数
    {
      id: PromOperationId.HistogramQuantile,
      name: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: (op) => `计算直方图的 ${op.params[0]} 分位数`,
    },
    createSimpleFunction(PromOperationId.HistogramAvg, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.HistogramCount, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.HistogramSum, PromVisualQueryOperationCategory.Functions),
    {
      id: PromOperationId.HistogramFraction,
      name: 'Histogram fraction',
      params: [
        { name: 'Lower scalar', type: 'number' },
        { name: 'Upper scalar', type: 'number' },
      ],
      defaultParams: [0.0, 0.2],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: (op) => `计算直方图中 ${op.params[0]} 到 ${op.params[1]} 范围内的分数`,
    },
    createSimpleFunction(PromOperationId.HistogramStddev, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.HistogramStdvar, PromVisualQueryOperationCategory.Functions),

    // Label 操作
    {
      id: PromOperationId.LabelReplace,
      name: 'Label replace',
      params: [
        { name: 'Destination label', type: 'string' },
        { name: 'Replacement', type: 'string' },
        { name: 'Source label', type: 'string' },
        { name: 'Regex', type: 'string' },
      ],
      category: PromVisualQueryOperationCategory.Functions,
      defaultParams: ['', '$1', '', '(.*)'],
      renderer: functionRendererRight,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: () => '使用正则表达式替换标签值',
    },

    {
      id: PromOperationId.LabelJoin,
      name: 'Label join',
      params: [
        { name: 'Destination Label', type: 'string' },
        { name: 'Separator', type: 'string' },
        { name: 'Source Label', type: 'string', restParam: true, optional: true },
      ],
      defaultParams: ['', ',', ''],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: labelJoinRenderer,
      explainHandler: () => '将多个标签的值连接成一个新标签',
      addOperationHandler: defaultAddOperationHandler,
    },

    // 范围函数
    createRangeFunction(PromOperationId.Changes),
    createRangeFunction(PromOperationId.Rate, true),
    createRangeFunction(PromOperationId.Irate, true),
    createRangeFunction(PromOperationId.Increase, true),
    createRangeFunction(PromOperationId.Idelta),
    createRangeFunction(PromOperationId.Delta),
    createRangeFunction(PromOperationId.Deriv),
    createRangeFunction(PromOperationId.Resets),

    // 高级范围函数
    {
      id: PromOperationId.PredictLinear,
      name: getPromOperationDisplayName(PromOperationId.PredictLinear),
      params: [getRangeVectorParamDef(), { name: 'Seconds from now', type: 'number' }],
      defaultParams: ['$__interval', 60],
      alternativesKey: 'range function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererRightWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
      explainHandler: (op) => `基于 ${op.params[0]} 时间范围预测 ${op.params[1]} 秒后的值`,
    },
    {
      id: PromOperationId.HoltWinters,
      name: getPromOperationDisplayName(PromOperationId.HoltWinters),
      params: [getRangeVectorParamDef(), { name: 'Smoothing Factor', type: 'number' }, { name: 'Trend Factor', type: 'number' }],
      defaultParams: ['$__interval', 0.5, 0.5],
      alternativesKey: 'range function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererRightWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
      explainHandler: () => 'Holt-Winters 平滑预测',
    },
    {
      id: PromOperationId.QuantileOverTime,
      name: getPromOperationDisplayName(PromOperationId.QuantileOverTime),
      params: [getRangeVectorParamDef(), { name: 'Quantile', type: 'number' }],
      defaultParams: ['$__interval', 0.5],
      alternativesKey: 'overtime function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererLeftWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
      explainHandler: (op) => `计算时间范围内的 ${op.params[1]} 分位数`,
    },

    // 通用函数
    createSimpleFunction(PromOperationId.Abs, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Absent, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Ceil, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Floor, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Sqrt, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Exp, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Ln, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Log2, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Log10, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Sgn, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Deg, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Rad, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Scalar, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.Sort, PromVisualQueryOperationCategory.Functions),
    createSimpleFunction(PromOperationId.SortDesc, PromVisualQueryOperationCategory.Functions),

    // 三角函数
    createSimpleFunction(PromOperationId.Acos, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Acosh, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Asin, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Asinh, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Atan, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Atanh, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Cos, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Cosh, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Sin, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Sinh, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Tan, PromVisualQueryOperationCategory.Trigonometric),
    createSimpleFunction(PromOperationId.Tanh, PromVisualQueryOperationCategory.Trigonometric),

    // 带参数的函数
    {
      id: PromOperationId.Clamp,
      name: 'Clamp',
      params: [
        { name: 'Minimum Scalar', type: 'number' },
        { name: 'Maximum Scalar', type: 'number' },
      ],
      defaultParams: [1, 1],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: (op) => `将值限制在 ${op.params[0]} 到 ${op.params[1]} 之间`,
    },
    createFunctionWithParam(PromOperationId.ClampMax, 'Maximum Scalar', 'number', 1),
    createFunctionWithParam(PromOperationId.ClampMin, 'Minimum Scalar', 'number', 1),
    {
      id: PromOperationId.Round,
      name: getPromOperationDisplayName(PromOperationId.Round),
      params: [{ name: 'To Nearest', type: 'number' }],
      defaultParams: [1],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: (op) => `四舍五入到最接近的 ${op.params[0]} 的倍数`,
    },
    {
      id: PromOperationId.Vector,
      name: 'Vector',
      params: [{ name: 'Value', type: 'number' }],
      defaultParams: [1],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: (model) => `${model.id}(${model.params[0]})`,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: (op) => `返回标量值 ${op.params[0]} 作为向量`,
    },

    // 时间函数
    createSimpleFunction(PromOperationId.Hour, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.Minute, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.DayOfMonth, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.DayOfWeek, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.DayOfYear, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.DaysInMonth, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.Month, PromVisualQueryOperationCategory.Time),
    createSimpleFunction(PromOperationId.Year, PromVisualQueryOperationCategory.Time),
    {
      id: PromOperationId.Time,
      name: 'Time',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Time,
      alternativesKey: 'time-functions',
      renderer: (model) => `${model.id}()`,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: () => '返回当前 Unix 时间戳',
    },
    createSimpleFunction(PromOperationId.Timestamp, PromVisualQueryOperationCategory.Time),
    {
      id: PromOperationId.Pi,
      name: 'Pi',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: (model) => `${model.id}()`,
      addOperationHandler: defaultAddOperationHandler,
      explainHandler: () => '返回圆周率 π',
    },

    // 二元标量操作
    ...binaryScalarOperations,

    // 二元查询操作（Binary operation with query）
    // 参考 Grafana operations.ts 第 127-134 行
    {
      id: PromOperationId.NestedQuery,
      name: '二元查询',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: (_model, _def, innerExpr) => innerExpr,
      addOperationHandler: addNestedQueryHandler,
    },
  ];

  return list;
}

function createRangeFunction(name: string, withRateInterval: boolean = false): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromOperationDisplayName(name),
    params: [getRangeVectorParamDef(withRateInterval)],
    defaultParams: [withRateInterval ? '$__rate_interval' : '$__interval'],
    alternativesKey: 'range function',
    category: PromVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addOperationWithRangeVector,
    changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
    explainHandler: (op) => {
      const range = op.params[0] || '$__interval';
      const descriptions: Record<string, string> = {
        rate: `计算 [${range}] 时间范围内的每秒平均增长率`,
        irate: `计算 [${range}] 时间范围内的瞬时增长率（基于最后两个数据点）`,
        increase: `计算 [${range}] 时间范围内的总增长量`,
        delta: `计算 [${range}] 时间范围内第一个和最后一个值的差值`,
        idelta: `计算 [${range}] 时间范围内最后两个样本的差值`,
        deriv: `计算 [${range}] 时间范围内的每秒导数`,
        changes: `计算 [${range}] 时间范围内值的变化次数`,
        resets: `计算 [${range}] 时间范围内计数器重置的次数`,
      };
      return descriptions[name] || `应用 ${name} 函数`;
    },
  };
}

/**
 * 范围向量渲染器
 */
function operationWithRangeVectorRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string): string {
  const rangeVector = (model.params ?? [])[0] ?? '5m';
  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

/**
 * 添加范围向量操作（只能有一个范围向量操作）
 */
export function addOperationWithRangeVector(def: QueryBuilderOperationDef, query: PromVisualQuery, modeller: VisualQueryModeller): PromVisualQuery {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  if (query.operations.length > 0 && query.operations[0]?.id) {
    const firstOp = modeller.getOperationDef(query.operations[0].id);
    if (firstOp && firstOp.addOperationHandler === addOperationWithRangeVector) {
      return {
        ...query,
        operations: [newOperation, ...query.operations.slice(1)],
      };
    }
  }

  return {
    ...query,
    operations: [newOperation, ...query.operations],
  };
}

/**
 * 范围函数类型变更处理器
 */
function operationTypeChangedHandlerForRangeFunction(operation: QueryBuilderOperation, newDef: QueryBuilderOperationDef): QueryBuilderOperation {
  if (operation.params[0] === '$__rate_interval' && newDef.defaultParams[0] !== '$__rate_interval') {
    operation.params = newDef.defaultParams;
  } else if (operation.params[0] === '$__interval' && newDef.defaultParams[0] !== '$__interval') {
    operation.params = newDef.defaultParams;
  }
  return operation;
}

/**
 * Label join 渲染器
 */
function labelJoinRenderer(model: QueryBuilderOperation, _def: QueryBuilderOperationDef, innerExpr: string): string {
  const destinationLabel = String(model.params[0] ?? '');
  const separator = String(model.params[1] ?? '');
  const sourceLabels = model.params
    .slice(2)
    .map((v) => String(v))
    .filter((v) => v.trim().length > 0);

  // PromQL: label_join(v instant-vector, dst_label string, separator string, src_label_1 string, src_label_2 string, ...)
  const args = [innerExpr, quotePromqlString(destinationLabel), quotePromqlString(separator), ...sourceLabels.map(quotePromqlString)];
  return `${model.id}(${args.join(', ')})`;
}

function createSimpleFunction(name: string, category: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromOperationDisplayName(name),
    params: [],
    defaultParams: [],
    category,
    // Allow switching between time functions via the operation dropdown.
    // This avoids an "empty dropdown" UX when a time op is added.
    alternativesKey: category === PromVisualQueryOperationCategory.Time ? 'time-functions' : undefined,
    renderer: functionRendererLeft,
    addOperationHandler: defaultAddOperationHandler,
    explainHandler: () => {
      const descriptions: Record<string, string> = {
        abs: '返回绝对值',
        ceil: '向上取整到最接近的整数',
        floor: '向下取整到最接近的整数',
        sqrt: '计算平方根',
        exp: '计算 e 的指数',
        ln: '计算自然对数',
        log2: '计算以 2 为底的对数',
        log10: '计算以 10 为底的对数',
        sgn: '返回符号（-1, 0, 1）',
        time: '返回当前 Unix 时间戳',
        timestamp: '返回每个样本的时间戳',
        hour: '返回小时（0-23）',
        minute: '返回分钟（0-59）',
        day_of_month: '返回月份中的第几天（1-31）',
        day_of_week: '返回星期几（0-6，0 表示星期日）',
        month: '返回月份（1-12）',
        year: '返回年份',
      };
      return descriptions[name] || `应用 ${name} 函数`;
    },
  };
}

function createFunctionWithParam(name: string, paramName: string, paramType: 'string' | 'number', defaultValue: any): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromOperationDisplayName(name),
    params: [{ name: paramName, type: paramType }],
    defaultParams: [defaultValue],
    category: PromVisualQueryOperationCategory.Functions,
    renderer: functionRendererLeft,
    addOperationHandler: defaultAddOperationHandler,
    explainHandler: (op) => {
      const value = op.params[0];
      if (name === 'clamp_max') {
        return `将所有值限制在最大值 ${value} 以内`;
      } else if (name === 'clamp_min') {
        return `将所有值限制在最小值 ${value} 以上`;
      }
      return `应用 ${name} 函数`;
    },
  };
}
