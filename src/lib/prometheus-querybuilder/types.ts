/**
 * @fileoverview 查询构建器核心类型定义
 * @description
 *   定义 PromQL 查询构建器的核心数据结构。
 *       主要内容：
 *       - PromVisualQuery: 可视化查询对象（metric + labels + operations + binaryQueries）
 *       - QueryBuilderOperation: 查询操作（id + params）
 *       - QueryBuilderOperationDef: 操作定义（包含渲染器、处理器等）
 *       - QueryBuilderLabelFilter: 标签过滤器
 *       - PromOperationId: 操作 ID 枚举（包含所有支持的操作）
 *       - PromVisualQueryBinary: 二元查询结构
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/types.ts
 */
/**
 * Prometheus Query Builder 类型定义
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/types.ts
 */
import type { QueryBuilderLabelFilter, QueryBuilderOperation, QueryBuilderOperationDef, VisualQueryBinary } from './shared/types';

// 重新导出 shared types，以便其他模块可以从这里导入
export type { QueryBuilderLabelFilter, QueryBuilderOperation, QueryBuilderOperationDef, VisualQueryBinary };
export * from './shared/types';

/**
 * Visual query model
 */
export interface PromVisualQuery {
  metric: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: PromVisualQueryBinary[];
}

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

export type PromVisualQueryBinary = VisualQueryBinary<PromVisualQuery>;

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
