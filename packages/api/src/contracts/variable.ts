/**
 * 文件说明：VariableService 契约
 *
 * 变量系统的运行时能力入口：
 * - 初始化 values/options
 * - 为 query 型变量解析 options（由实现层决定怎么拉取）
 */
import type { DashboardSessionKey, DashboardVariable, TimeRange, VariableOption, VariablesState } from '@grafana-fast/types';

export interface ResolveVariableOptionsContext {
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
   * - 变量 options 解析可能触发多次请求（多个 query 变量）
   * - 上层可在页面卸载/切换 dashboard 时传入 signal 以主动取消
   */
  signal?: AbortSignal;
}

/**
 * VariableService（契约层）
 *
 * 设计意图：
 * - 变量系统不仅是 UI 的下拉选择，还要能支撑查询插值与联动刷新
 * - “变量 options 从哪里来”（静态 / query-based / 远端）由实现层决定
 *
 * 约定：
 * - initialize：把 Dashboard JSON 中的变量定义归一化为运行时状态（values/options）
 * - resolveOptions：为 query 型变量拉取/计算 options（可增量、可缓存）
 */
export interface VariableService {
  /**
   * 初始化变量运行时状态
   *
   * 输入：
   * - variables：来自 Dashboard JSON 的变量定义
   *
   * 输出：
   * - VariablesState：包含 values/options/lastUpdatedAt
   *
   * 说明：
   * - includeAll/multi 等语义应在这里被归一化，便于上层统一使用
   */
  initialize: (variables: DashboardVariable[] | undefined) => VariablesState;

  /**
   * 为变量解析 options（重点用于 query 型变量）
   *
   * 说明：
   * - 实现层应尽量做到“增量”和“可缓存”（避免频繁请求）
   * - 返回值仅包含需要更新的变量 options（上层可以 merge）
   */
  resolveOptions: (
    variables: DashboardVariable[],
    state: VariablesState,
    timeRange: TimeRange,
    context?: ResolveVariableOptionsContext
  ) => Promise<Record<string, VariableOption[]>>;
}
