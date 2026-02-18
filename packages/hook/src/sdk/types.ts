import type { GrafanaFastApiClient } from '@grafana-fast/api';
import type { DashboardTheme, DashboardThemePreference } from '@grafana-fast/dashboard';
import type { ID, TimeRange } from '@grafana-fast/types';
import type { Unsubscribe } from '../emitter';

export interface DashboardSdkOptions {
  /** 指定加载的 dashboard id，默认加载 default */
  dashboardId?: string;
  /**
   * Dashboard 实例唯一 id（用于多实例隔离）
   *
   * 建议：
   * - 宿主应用应为每个 Dashboard 实例传入稳定且唯一的 id
   * - 用于本地持久化（例如设置按钮位置）、调度器 scope、日志/调试定位等
   *
   * 未提供时会生成一个“当前 SDK 生命周期内稳定”的随机 id（刷新页面后会变化）。
   */
  instanceId?: string;
  /** 是否自动加载 dashboard 数据，默认为 true */
  autoLoad?: boolean;
  /**
   * 运行时 API client（远程模式）
   *
   * 适用场景：
   * - 宿主应用已自行管理鉴权/请求/环境切换
   * - 需要在运行时切换不同数据源或不同后端实例
   *
   * 注意：
   * - 远程模式下必须提供该字段，否则 load/save/query 会失败
   */
  apiClient?: GrafanaFastApiClient;
  /**
   * 是否启用“本地 mock”能力开关（默认 false）
   *
   * 说明：
   * - 仅用于本地开发/演示：在 Dashboard 的“全局设置”里出现 mock/remote 切换
   * - 生产环境建议关闭（避免误用 mock）
   */
  enableMock?: boolean;
  /**
   * 创建 mock apiClient 的工厂函数（仅在 enableMock=true 时生效）
   *
   * 重要：
   * - 该函数由宿主提供，SDK/hook 包内部不直接 import mock 实现
   * - 这样生产构建不会默认把 mock 数据打入 bundle
   */
  createMockApiClient?: () => GrafanaFastApiClient | Promise<GrafanaFastApiClient>;
  /**
   * 默认使用的 API 模式
   * - remote：使用 apiClient
   * - mock：使用 createMockApiClient
   *
   * 未提供时的策略：
   * - 优先 remote（如果 apiClient 存在）
   * - 否则退化为 mock（如果 enableMock + createMockApiClient 存在）
   */
  defaultApiMode?: 'remote' | 'mock';
  /** SDK 准备好后触发 */
  onReady?: () => void;
  /** SDK 释放前触发 */
  onBeforeUnmount?: () => void;
  /** 异常回调 */
  onError?: (error: unknown) => void;

  /**
   * 主题偏好（light/dark/system）
   *
   * 说明：
   * - 默认：'system'
   * - 该偏好只影响当前 dashboard 实例的渲染（通过 DashboardView 的 `theme` prop）
   * - 默认不会修改宿主的 `documentElement.dataset`（避免嵌入式场景污染宿主全局）
   */
  themePreference?: DashboardThemePreference;
  /**
   * 是否持久化主题偏好到 localStorage
   * 默认：false（嵌入式场景下不建议默认写宿主存储）
   */
  persistThemePreference?: boolean;
  /**
   * 是否把主题应用到全局 document（documentElement.dataset）
   *
   * 说明：
   * - 只有当你明确要“全站接管主题”时才建议开启
   * - 默认：false
   */
  applyThemeToDocument?: boolean;

  /**
   * Portal 挂载点（用于 Modal/Drawer/Dropdown/Select 等 Teleport 浮层）
   *
   * 默认：不传（DashboardView 内部默认挂到 body）
   * 嵌入式建议：传入 Dashboard 容器或宿主指定容器，增强隔离/便于销毁。
   */
  portalTarget?: string | HTMLElement | null;

  /**
   * 全局只读模式（能力开关）
   *
   * 语义：
   * - true：禁用所有会修改 Dashboard JSON 的操作（创建/删除/拖拽/导入/应用/保存/编辑面板等）
   * - false：允许编辑（仍受 viewMode / 当前打开组等规则约束）
   */
  readOnly?: boolean;
}

export type DashboardSdkViewMode = 'grouped' | 'allPanels';
export type DashboardSdkBootStage = 'idle' | 'fetching' | 'parsing' | 'initializing' | 'ready' | 'error';

export interface DashboardSdkDashboardSummary {
  /**
   * DashboardId（资源标识）
   *
   * 说明：
   * - 该 id 不属于 Dashboard JSON（DashboardContent）的一部分
   * - 它来自宿主传入/后端定位（用于 load/save/delete）
   */
  id: ID | null;
  name: string;
  groupCount: number;
  panelCount: number;
}

/**
 * 对宿主应用暴露的“状态快照”（Snapshot）
 *
 * 设计目标（强隔离 + 可观测）：
 * - **强隔离**：永远不要返回内部 store/ref/reactive 对象的引用（避免外部直接改内部）
 * - **轻量**：state 只包含“稳定 + 高频需要”的字段，不提供 JSON/面板等大对象快照读取
 * - **可观测**：配合 `on('change')` 事件，宿主可建立自己的镜像 state（但镜像仍是宿主侧的数据）
 */
export interface DashboardSdkStateSnapshot {
  instanceId: string;
  mounted: boolean;
  ready: boolean;
  containerSize: { width: number; height: number };
  theme: DashboardTheme;
  themePreference: DashboardThemePreference;
  readOnly: boolean;
  viewMode: DashboardSdkViewMode;
  isBooting: boolean;
  bootStage: DashboardSdkBootStage;
  isSaving: boolean;
  isSyncing: boolean;
  hasUnsyncedChanges: boolean;
  lastError: string | null;
  timeRange: TimeRange;
  /** 当前全屏面板 id（如有）；`null` 表示没有处于全屏状态的面板。 */
  viewPanelId: { groupId: ID; panelId: ID } | null;
  /** Dashboard 摘要信息（不包含重的 JSON 内容）。 */
  dashboard: DashboardSdkDashboardSummary | null;
  /**
   * variables 值变化代际（单调递增）
   *
   * 用途：
   * - 让宿主侧无需 deep-watch variables/options 大对象，就能知道“变量值是否变化”
   */
  variablesRevision: number;
  /**
   * dashboard 内容变更代际（单调递增）
   *
   * 用途：
   * - 让宿主侧无需 deep-watch 大对象，就能知道 dashboard JSON 是否发生变化
   */
  dashboardRevision: number;
}

export interface DashboardSdkChangePayload {
  /** 事件触发时间戳（ms）。 */
  at: number;
  /** 最新的 public state 快照。 */
  state: DashboardSdkStateSnapshot;
  /** 上一次对外发出的 state（首次触发时为 null）。 */
  prevState: DashboardSdkStateSnapshot | null;
  /** 相对于 prevState，发生变化的顶层 key 列表。 */
  changedKeys: Array<keyof DashboardSdkStateSnapshot>;
  /** 便捷标记：dashboard 是否变化（等价于 changedKeys 包含 dashboardRevision）。 */
  dashboardChanged: boolean;
}

export interface DashboardSdkEventMap {
  /** 统一的变化事件（state + diff 元信息）。 */
  change: DashboardSdkChangePayload;
  /** SDK 或内部 store 的错误事件。 */
  error: { error: unknown };
}

export type DashboardSdkEventName = keyof DashboardSdkEventMap;

export interface DashboardSdkActions {
  /**
   * 将 dashboard 状态重置为“等待加载”（类似浏览器刷新后的初始状态）
   *
   * 典型用法：
   * - 宿主先异步获取 dashboardId（资源标识）
   * - 获取期间希望展示 boot mask 的 waiting 状态（“正在连接数据”）
   * - 拿到 id 后再调用 loadDashboard(id)
   */
  resetDashboard: () => void;
  /** 按 dashboardId（资源标识）加载 dashboard 内容（不做历史 schema 迁移，依赖后端/宿主保证结构正确） */
  loadDashboard: (id: ID) => Promise<void>;
  /** 保存当前 dashboard（落库或写回后端/本地实现） */
  saveDashboard: () => Promise<void>;
  /** 设置时间范围（会触发相关面板刷新） */
  setTimeRange: (range: TimeRange) => unknown;
  /** 设置刷新间隔（ms，0 表示关闭自动刷新） */
  setRefreshInterval: (interval: number) => unknown;
  /** 主动触发一次刷新（按当前 timeRange/变量执行） */
  refreshTimeRange: () => unknown;
  /** 设置主题偏好并应用（light/dark/system） */
  setTheme: (theme: DashboardTheme) => DashboardTheme;
  /** 设置主题偏好（light/dark/system）并持久化 */
  setThemePreference: (preference: DashboardThemePreference) => DashboardTheme;
  /** 在 light/dark 间切换 */
  toggleTheme: () => DashboardTheme;
  /** 获取当前实际主题（light/dark） */
  getTheme: () => DashboardTheme;

  /** 设置全局只读模式（能力开关） */
  setReadOnly: (readOnly: boolean) => void;

  /** 设置单个变量值（会触发相关面板刷新） */
  setVariableValue: (name: string, value: string | string[]) => void;
  /** 批量设置变量值（会触发相关面板刷新） */
  setVariableValues: (values: Record<string, string | string[]>) => void;
  /** 刷新变量 options（query 型变量） */
  refreshVariableOptions: () => void;
}

export interface UseDashboardSdkResult {
  /**
   * 订阅 SDK 事件（实例级，不是全局事件总线）
   *
   * 返回值：
   * - 一个 unsubscribe 函数，用于取消订阅（建议在 onUnmounted 中调用）
   */
  on: <K extends DashboardSdkEventName>(event: K, handler: (payload: DashboardSdkEventMap[K]) => void) => Unsubscribe;
  /** 取消订阅（也可直接调用 on() 的返回值）。 */
  off: <K extends DashboardSdkEventName>(event: K, handler: (payload: DashboardSdkEventMap[K]) => void) => void;

  /** 获取最新的 public state 快照（可被外部安全修改，不会影响内部）。 */
  getState: () => DashboardSdkStateSnapshot;

  /** 命令式操作集合（宿主修改内部的唯一支持方式）。 */
  actions: DashboardSdkActions;
}
