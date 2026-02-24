/**
 * 文件说明：VariableService 契约
 *
 * 本项目采用“后端全量下发变量”的模式：
 * - 前端不从 Dashboard JSON 读取 variables（不导入/导出，不随 dashboards/load round-trip）
 * - 后端根据 `dashboardSessionKey` 返回该 dashboard 需要的变量定义（含 options + 默认值）
 * - 用户修改变量值后，前端回写给后端；后端可选择持久化为默认值，并返回更新后的整份变量列表
 */

import type { DashboardSessionKey, DashboardVariable } from '@grafana-fast/types';

export interface VariablesRequestContext {
  /**
   * （可选）Dashboard 会话级访问 key
   *
   * 说明：
   * - 用于嵌入式 Dashboard 场景：宿主/后端签发 `dashboardSessionKey`，前端在所有请求中携带
   * - HTTP 实现层建议把它映射为 header：`X-Dashboard-Session-Key`
   */
  dashboardSessionKey?: DashboardSessionKey;

  /**
   * （可选）取消信号
   *
   * 说明：
   * - 页面卸载/切换 dashboard 时可取消 in-flight 请求
   */
  signal?: AbortSignal;
}

/**
 * VariableService（契约层）
 *
 * 设计意图：
 * - 提供“加载整份变量定义”的唯一入口
 * - 提供“应用变量值并回写默认值”的入口（后端可同时更新 options/current）
 */
export interface VariableService {
  /**
   * 加载整份全局变量定义（含 options + 默认 current）
   */
  loadVariables: (context?: VariablesRequestContext) => Promise<DashboardVariable[]>;

  /**
   * 应用变量值（回写默认值），并返回更新后的整份变量定义
   *
   * @param values 当前变量值（可传全量或仅传变化项；以实现层约定为准）
   */
  applyVariables: (values: Record<string, string | string[]>, context?: VariablesRequestContext) => Promise<DashboardVariable[]>;
}

