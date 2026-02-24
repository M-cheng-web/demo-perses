/**
 * Dashboard 相关类型定义
 */

import type { ID, Timestamp } from './common';
import type { PanelGroup } from './panelGroup';

/**
 * DashboardId（资源标识）
 *
 * 说明：
 * - 这是“Dashboard 资源”的外部标识（通常来自路由/业务接口/后端数据库主键）
 * - 注意：Dashboard JSON 内容（DashboardContent）**不包含** dashboardId
 */
export type DashboardId = ID;

/**
 * DashboardSessionKey（会话级访问 Key）
 *
 * 说明：
 * - 这是宿主应用/后端签发给前端的“临时访问 key”（opaque string）
 * - 前端不应知道真实的 dashboardId（资源标识），只持有 sessionKey
 * - 后端可通过 sessionKey 映射到真实 dashboard 资源并做续租/过期控制
 * - HTTP 传输建议放在 header（如 `X-Dashboard-Session-Key`），避免出现在 URL/query 中
 */
export type DashboardSessionKey = string;

/**
 * Dashboard 内容（可导入/导出/持久化的 JSON）
 *
 * 设计约束：
 * - 该结构是“纯内容”，不包含 dashboardId（资源标识）
 * - `timeRange/refreshInterval` 属于运行时全局 UI 状态：不存入 Dashboard JSON（由前端运行时 store 管理）
 * - 变量（variables）属于运行时上下文：由后端按 `dashboardSessionKey` 下发（不随 Dashboard JSON 导入/导出）
 * - 建议由宿主/后端协议承载会话级 key（例如 `dashboardSessionKey` header），真实 dashboardId 仅后端内部存在
 *
 * 典型用途：
 * - 用户导入/导出 JSON 文件
 * - 后端返回/保存 Dashboard 内容（由 sessionKey 或内部资源 id 定位）
 */
export interface DashboardContent {
  /**
   * Dashboard JSON schema 版本号（保留字段，当前仅做持久化）
   *
   * 说明：
   * - 当前阶段不在前端内置 migration/兼容逻辑
   * - 该字段会随 Dashboard JSON 一起保存/导出，供未来演进使用
   */
  schemaVersion: number;
  /** Dashboard 名称 */
  name: string;
  /** Dashboard 描述 */
  description?: string;
  /** 面板组列表 */
  panelGroups: PanelGroup[];
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
   * query 类型变量：查询表达式（由实现层解释）
   * - Prometheus 常见：label_values(...) / metrics / series
   */
  query?: string;
  /**
   * 变量选项（可选）
   *
   * 说明：
   * - options 用于渲染下拉列表（select/query 型变量常见）
   * - options 的来源由实现层决定（后端下发/运行时解析/缓存），可能与 timeRange/变量值有关
   */
  options?: VariableOption[];
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
  /** Dashboard ID（资源标识，等价于 DashboardId） */
  id: DashboardId;
  /** Dashboard 名称 */
  name: string;
  /** Dashboard 描述 */
  description?: string;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}
