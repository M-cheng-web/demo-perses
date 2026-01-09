/**
 * 查询相关类型定义
 */

import type { ID, KeyValue, Timestamp } from './common';
import type { TimeRange } from './timeRange';

/**
 * 查询定义
 */
export interface Query {
  /** 查询 ID */
  id: ID;
  /** 数据源名称 */
  datasource: string;
  /** PromQL 表达式 */
  expr: string;
  /** 图例格式模板 */
  legendFormat?: string;
  /** 最小步长（秒） */
  minStep?: number;
  /** 查询格式 */
  format?: QueryFormat;
  /** 是否即时查询 */
  instant?: boolean;
}

/**
 * 查询格式
 */
export type QueryFormat = 'time_series' | 'table' | 'heatmap';

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
  /** 查询表达式 */
  expr: string;
  /** 数据 */
  data: TimeSeriesData[];
  /** 错误信息 */
  error?: string;
  /** 加载状态 */
  loading?: boolean;
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
