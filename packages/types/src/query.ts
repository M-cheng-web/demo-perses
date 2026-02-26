/**
 * 查询相关类型定义
 */

import type { ID, KeyValue, Timestamp } from './common';
import type { TimeRange } from './timeRange';
import type { PromVisualQuery } from './queryBuilder';

/**
 * 查询定义
 */
export type QueryFormat = 'time_series' | 'table' | 'heatmap';

/**
 * 规范化查询（存储/传输层）
 * - 以 id 为唯一对齐键：QueryResult.queryId 必须等于 CanonicalQuery.id
 * - UI 展示用的 A/B/C... 由前端按数组顺序派生，不再持久化到该结构中
 */
export interface CanonicalQuery {
  /** 查询唯一 ID（用于持久化/对齐） */
  id: ID;
  /**
   * 注意：
   * - 本项目不在前端暴露数据源选择能力；执行层会按租户/环境/默认配置选择数据源。
   */
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
 * 查询执行 DTO（发往后端执行接口）
 *
 * 说明：
 * - 该结构用于 `POST /queries/execute` 的入参 queries[]
 * - 字段固定齐全：前端会补齐默认值后再发送（避免接口层出现“可选/不可选”的歧义）
 * - 不包含 visualQuery：visualQuery 仅用于编辑器反显/round-trip（落库字段）
 */
export interface QueryExecuteDTO {
  /** 查询 ID（用于对齐 QueryResult.queryId） */
  id: ID;
  /** 查询表达式（通常为 PromQL；执行前前端会做变量插值） */
  expr: string;
  /** 图例格式（默认空字符串） */
  legendFormat: string;
  /** 最小步长（秒，默认 15） */
  minStep: number;
  /** 查询格式（默认 time_series） */
  format: QueryFormat;
  /** 是否即时查询（默认 false） */
  instant: boolean;
  /** 是否隐藏（默认 false；通常 hide=true 的 query 不会被发送） */
  hide: boolean;
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
