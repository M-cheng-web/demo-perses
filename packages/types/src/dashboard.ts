/**
 * Dashboard 相关类型定义
 */

import type { ID, Timestamp } from './common';
import type { PanelGroup } from './panelGroup';
import type { TimeRange } from './timeRange';

/**
 * Dashboard 定义
 */
export interface Dashboard {
  /**
   * Dashboard JSON schema 版本号（用于导入/导出迁移）
   * - 业务侧导入旧 JSON 时应先 migrate 到当前版本
   */
  schemaVersion?: number;
  /** Dashboard ID */
  id: ID;
  /** Dashboard 名称 */
  name: string;
  /** Dashboard 描述 */
  description?: string;
  /** 面板组列表 */
  panelGroups: PanelGroup[];
  /** 时间范围 */
  timeRange: TimeRange;
  /** 刷新间隔（毫秒，0 表示不自动刷新） */
  refreshInterval: number;
  /** 变量列表 */
  variables?: DashboardVariable[];
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}

/**
 * Dashboard 变量
 */
export interface DashboardVariable {
  /** 变量 ID */
  id: ID;
  /** 变量名称 */
  name: string;
  /** 变量标签（显示名称） */
  label: string;
  /** 变量类型 */
  type: VariableType;
  /**
   * query 类型变量：数据源（例如 prometheus）
   * - 仅用于 UI 与实现层选择服务；真正执行由 @grafana-fast/api 实现决定
   */
  datasource?: string;
  /**
   * query 类型变量：查询表达式（由实现层解释）
   * - Prometheus 常见：label_values(...) / metrics / series
   */
  query?: string;
  /** 变量选项 */
  options: VariableOption[];
  /** 当前值 */
  current: string | string[];
  /** 是否支持多选 */
  multi?: boolean;
  /** 是否包含 “All” 选项（Grafana 语义） */
  includeAll?: boolean;
  /** All 的实际值（通常为 '.*'），由插值层按策略解释 */
  allValue?: string;
}

/**
 * 变量类型
 */
export type VariableType = 'select' | 'input' | 'constant' | 'query';

/**
 * 变量选项
 */
export interface VariableOption {
  /** 显示文本 */
  text: string;
  /** 实际值 */
  value: string;
}

/**
 * 当前变量运行时状态（用于执行/插值/刷新调度）
 */
export interface VariablesState {
  /** 当前变量值：key 为变量 name */
  values: Record<string, string | string[]>;
  /** 当前变量 options：key 为变量 name（用于 select/query 变量渲染） */
  options: Record<string, VariableOption[]>;
  /** 上次更新的时间戳（ms） */
  lastUpdatedAt: number;
}

/**
 * Dashboard 创建参数
 */
export interface CreateDashboardParams {
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
}

/**
 * Dashboard 更新参数
 */
export interface UpdateDashboardParams {
  /** 名称 */
  name?: string;
  /** 描述 */
  description?: string;
}

/**
 * Dashboard 列表项
 */
export interface DashboardListItem {
  /** Dashboard ID */
  id: ID;
  /** Dashboard 名称 */
  name: string;
  /** Dashboard 描述 */
  description?: string;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}
