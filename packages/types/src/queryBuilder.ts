/**
 * QueryBuilder 查询构建器类型定义
 * 移植自 demo-query-builder 项目
 */

// ==================== 基础类型 ====================

// 标签过滤器
export interface QueryBuilderLabelFilter {
  label: string;
  op: string;
  value: string;
}

// 操作参数值类型
export type QueryBuilderOperationParamValue = string | number | boolean;

// 操作
export interface QueryBuilderOperation {
  id: string;
  params: QueryBuilderOperationParamValue[];
}

// ==================== 操作定义相关 ====================

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

// ==================== 查询模型 ====================

/**
 * PromQL Vector Matching（用于二元运算 on()/ignoring()）
 *
 * 说明：
 * - 仅保留结构化版本：避免 “有 type 没 labels / 有 labels 没 type” 的半残状态
 * - UI/序列化建议直接存 `labels: string[]`，不要再用逗号字符串
 */
export interface VectorMatching {
  type: 'on' | 'ignoring';
  /**
   * label 列表（已拆分、无需手动拼接逗号）
   */
  labels: string[];
}

// 二元查询
export interface VisualQueryBinary<T> {
  operator: string;
  /**
   * Vector Matching（推荐使用）
   */
  vectorMatching?: VectorMatching;
  query: T;
}

// Prometheus 可视化查询
export interface PromVisualQuery {
  metric: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: PromVisualQueryBinary[];
}

export type PromVisualQueryBinary = VisualQueryBinary<PromVisualQuery>;

// 查询面板（单个查询）
export interface QueryPanel {
  refId: string; // A, B, C, D... 查询标识符
  query: PromVisualQuery; // Prometheus 查询对象
  hide?: boolean; // 是否在结果中隐藏
}

// ==================== 建模器接口 ====================

// 可视化查询建模器接口
export interface VisualQueryModeller {
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getAlternativeOperations(key: string): QueryBuilderOperationDef[];
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef | undefined;
}

// Prometheus 查询建模器接口
export interface PromQueryModellerInterface {
  renderLabels(labels: QueryBuilderLabelFilter[]): string;
  renderQuery(query: PromVisualQuery, nested?: boolean): string;
  hasBinaryOp(query: PromVisualQuery): boolean;
  getQueryPatterns(): PromQueryPattern[];
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getOperationDef(id: string): QueryBuilderOperationDef | undefined;
  getAlternativeOperations(key: string): QueryBuilderOperationDef[];
  getCategories(): string[];
}

// ==================== 枚举 ====================

// 查询编辑器模式
// @ts-ignore
export enum QueryEditorMode {
  Code = 'code',
  Builder = 'builder',
}

// 操作分类
// @ts-ignore
export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  BinaryOps = 'Binary operations',
  Trigonometric = 'Trigonometric',
  Time = 'Time Functions',
}

// Prometheus 操作 ID
// @ts-ignore
export enum PromOperationId {
  // Aggregations
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  Group = 'group',
  Stddev = 'stddev',
  Stdvar = 'stdvar',
  TopK = 'topk',
  BottomK = 'bottomk',
  CountValues = 'count_values',
  Quantile = 'quantile',
  LimitK = 'limitk',
  LimitRatio = 'limit_ratio',

  // Range Functions
  Rate = 'rate',
  Irate = 'irate',
  Increase = 'increase',
  Delta = 'delta',
  Idelta = 'idelta',
  Changes = 'changes',
  Deriv = 'deriv',
  Resets = 'resets',
  PredictLinear = 'predict_linear',
  HoltWinters = 'holt_winters',
  QuantileOverTime = 'quantile_over_time',
  AvgOverTime = 'avg_over_time',
  SumOverTime = 'sum_over_time',
  MinOverTime = 'min_over_time',
  MaxOverTime = 'max_over_time',
  CountOverTime = 'count_over_time',
  LastOverTime = 'last_over_time',
  PresentOverTime = 'present_over_time',
  AbsentOverTime = 'absent_over_time',
  StddevOverTime = 'stddev_over_time',

  // Functions
  Abs = 'abs',
  Absent = 'absent',
  Ceil = 'ceil',
  Floor = 'floor',
  Round = 'round',
  Sqrt = 'sqrt',
  Exp = 'exp',
  Ln = 'ln',
  Log2 = 'log2',
  Log10 = 'log10',
  Clamp = 'clamp',
  ClampMax = 'clamp_max',
  ClampMin = 'clamp_min',
  Sgn = 'sgn',
  Deg = 'deg',
  Rad = 'rad',
  Scalar = 'scalar',
  Sort = 'sort',
  SortDesc = 'sort_desc',
  Pi = 'pi',
  Vector = 'vector',

  // Time Functions
  Time = 'time',
  Timestamp = 'timestamp',
  Hour = 'hour',
  Minute = 'minute',
  DayOfMonth = 'day_of_month',
  DayOfWeek = 'day_of_week',
  DayOfYear = 'day_of_year',
  DaysInMonth = 'days_in_month',
  Month = 'month',
  Year = 'year',

  // Trigonometric Functions
  Acos = 'acos',
  Acosh = 'acosh',
  Asin = 'asin',
  Asinh = 'asinh',
  Atan = 'atan',
  Atanh = 'atanh',
  Cos = 'cos',
  Cosh = 'cosh',
  Sin = 'sin',
  Sinh = 'sinh',
  Tan = 'tan',
  Tanh = 'tanh',

  // Histogram Functions
  HistogramQuantile = 'histogram_quantile',
  HistogramAvg = 'histogram_avg',
  HistogramCount = 'histogram_count',
  HistogramSum = 'histogram_sum',
  HistogramFraction = 'histogram_fraction',
  HistogramStddev = 'histogram_stddev',
  HistogramStdvar = 'histogram_stdvar',

  // Label manipulation
  LabelReplace = 'label_replace',
  LabelJoin = 'label_join',

  // Binary ops - Arithmetic
  Addition = '__addition',
  Subtraction = '__subtraction',
  MultiplyBy = '__multiply_by',
  DivideBy = '__divide_by',
  Modulo = '__modulo',
  Exponent = '__exponent',

  // Binary ops - Comparison
  EqualTo = '__equal_to',
  NotEqualTo = '__not_equal_to',
  GreaterThan = '__greater_than',
  LessThan = '__less_than',
  GreaterOrEqual = '__greater_or_equal',
  LessOrEqual = '__less_or_equal',

  // Nested Query
  NestedQuery = '__nested_query',
}

// 查询模式类型
// @ts-ignore
export enum PromQueryPatternType {
  Rate = 'rate',
  Histogram = 'histogram',
  Binary = 'binary',
}

// 查询模式
export interface PromQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
  type: PromQueryPatternType;
  binaryQueries?: PromVisualQueryBinary[];
}

// ==================== 工具函数 ====================

/**
 * 生成下一个 refId
 * A -> B -> C ... Z -> AA -> AB ...
 */
export function generateNextRefId(existingRefIds: string[]): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let refId: string = 'A';
  let suffix = 0;

  while (existingRefIds.includes(refId)) {
    suffix++;
    if (suffix < 26) {
      refId = alphabet[suffix] || 'A';
    } else {
      // 超过 Z 后，使用 AA, AB, AC...
      const firstChar = alphabet[Math.floor((suffix - 26) / 26)] || 'A';
      const secondChar = alphabet[(suffix - 26) % 26] || 'A';
      refId = firstChar + secondChar;
    }
  }

  return refId;
}

/**
 * 创建默认查询面板
 */
export function createDefaultQueryPanel(refId: string): QueryPanel {
  return {
    refId,
    query: {
      metric: '',
      labels: [],
      operations: [],
    },
    hide: false,
  };
}

/**
 * 复制查询面板
 */
export function duplicateQueryPanel(panel: QueryPanel, newRefId: string): QueryPanel {
  return {
    ...JSON.parse(JSON.stringify(panel)), // 深拷贝
    refId: newRefId,
  };
}
