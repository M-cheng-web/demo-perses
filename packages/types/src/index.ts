/**
 * 类型定义统一导出
 *
 * 说明：
 * - 业务侧一般只需要从 `@grafana-fast/types` 引入类型
 * - 这里聚合导出，避免上层感知内部文件结构
 */

// 基础通用类型：ID/Timestamp 等
export * from './common';
// 时间范围（TimeRange）与相关工具类型
export * from './timeRange';
// 查询结果/数据点结构（用于 queryRunner/面板渲染）
export * from './query';
// 查询模型：CanonicalQuery / VisualQuery 等（存储/传输层与 UI 层的桥梁）
export * from './queryModel';
// 图表通用配置：axis/legend/format/threshold 等
export * from './chart';
// 面板定义：Panel/PanelOptions/PanelType
export * from './panel';
// 布局：PanelLayout 等
export * from './layout';
// 面板组：PanelGroup 等
export * from './panelGroup';
// Dashboard：顶层结构 + variables 等
export * from './dashboard';
// Datasource 定义（引用/配置/类型）
export * from './datasource';
// QueryBuilder 结构（可视化构建 query 的中间模型）
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
