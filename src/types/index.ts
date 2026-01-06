/**
 * 类型定义统一导出
 */

export * from './common';
export * from './timeRange';
export * from './query';
export * from './chart';
export * from './panel';
export * from './layout';
export * from './panelGroup';
export * from './dashboard';
export * from './datasource';
export * from './queryBuilder';
// 从 prometheus 导出，但排除 DataPoint (使用 query.ts 中的 DataPoint)
export type {
  PrometheusQueryResult,
  PrometheusDataPoint,
  TimeSeries,
  MetricMetadata,
  MetricItem,
  LabelValuesResponse,
  LabelNamesResponse,
  SeriesLabels,
  SeriesResponse,
  PrometheusDatasource,
  QueryHintType,
  QueryHint,
} from './prometheus';
// 导出 legend 中的类型，但排除与 chart 冲突的类型
export type { LegendMode, LegendSize, LegendValue, LegendItem, LegendSelection } from './legend';
export type { LegendOptions as LegendComponentOptions, LegendPosition as LegendComponentPosition } from './legend';
