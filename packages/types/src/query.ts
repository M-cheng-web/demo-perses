/**
 * 查询相关类型定义
 */

import type { ID, KeyValue, Timestamp } from './common';
import type { TimeRange } from './timeRange';
import type { DatasourceRef } from './queryModel';
import type { PromVisualQuery } from './queryBuilder';

/**
 * 查询定义
 */
export type QueryFormat = 'time_series' | 'table' | 'heatmap';

/**
 * 规范化查询（存储/传输层）
 * - refId: A/B/C...（与 Grafana 一致）
 * - datasourceRef: 不依赖 UI 的 datasource 名称字符串
 * - hide: 是否参与结果/渲染
 */
export interface CanonicalQuery {
  /** 查询唯一 ID（用于持久化/对齐） */
  id: ID;
  /**
   * 查询引用标识（Grafana 风格：A/B/C...）
   * - UI 展示、调试、以及多查询对齐使用
   */
  refId: string;
  /**
   * 数据源引用（与 UI 展示名称解耦）
   * - type：数据源类型（prometheus/...）
   * - uid：数据源唯一标识（例如 'prometheus-mock'）
   */
  datasourceRef: DatasourceRef;
  /** 查询表达式（PromQL 或其他实现层可解释的语法） */
  expr: string;
  /**
   * （可选）结构化可视化查询模型（QueryBuilder）
   *
   * 说明：
   * - 这是为了让 Builder 模式在“无需完整 PromQL parser”的情况下实现稳定反显（round-trip）
   * - QueryRunner/执行层只依赖 expr，不依赖该字段
   * - 当该字段存在时，UI 可优先使用它来反显 builder 表单（更可靠）
   */
  visualQuery?: PromVisualQuery;
  /** 图例格式（可选，面板/图表层解释） */
  legendFormat?: string;
  /** 最小步长（秒，部分实现层会用于 query_range 的 step 计算） */
  minStep?: number;
  /** 查询格式（time_series/table/heatmap） */
  format?: QueryFormat;
  /** 是否即时查询（true 表示瞬时点查询） */
  instant?: boolean;
  /** 是否隐藏（隐藏的 query 不参与渲染/结果展示） */
  hide?: boolean;
}

/**
 * 时间序列数据
 */
export interface TimeSeriesData {
  /** 指标标签 */
  metric: KeyValue;
  /** 数据点 [timestamp, value] */
  values: DataPoint[];
}

/**
 * 数据点 [timestamp, value]
 */
export type DataPoint = [Timestamp, number];

/**
 * 查询结果
 */
export interface QueryResult {
  /** 查询 ID */
  queryId: ID;
  /** refId（A/B/C...），用于 UI 对齐与调试 */
  refId?: string;
  /** 查询表达式 */
  expr: string;
  /** 数据 */
  data: TimeSeriesData[];
  /** 错误信息 */
  error?: string;
  /** 加载状态 */
  loading?: boolean;
  /** 可选元信息（实现层填充） */
  meta?: Record<string, any>;
}

/**
 * 查询上下文
 */
export interface QueryContext {
  /** 时间范围 */
  timeRange: TimeRange;
  /** 建议的步长（毫秒） */
  suggestedStepMs?: number;
}

/**
 * 表格数据
 */
export interface TableData {
  /** 列定义 */
  columns: TableColumn[];
  /** 行数据 */
  rows: TableRow[];
}

/**
 * 表格列
 */
export interface TableColumn {
  /** 列键 */
  key: string;
  /** 列标题 */
  title: string;
  /** 数据类型 */
  dataType?: 'string' | 'number' | 'timestamp';
  /** 宽度 */
  width?: number;
}

/**
 * 表格行
 */
export type TableRow = Record<string, any>;
