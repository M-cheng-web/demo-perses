import type { ApiImplementationKind, GrafanaFastApiClient } from '@grafana-fast/api';
import type { DashboardTheme, DashboardThemePreference, MousePosition } from '@grafana-fast/dashboard';
import type { DashboardContent, ID, Panel, PanelGroup, PanelLayout, TimeRange, VariablesState } from '@grafana-fast/types';
import type { Unsubscribe } from '../emitter';
import type { DashboardApi } from './api';

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
  /** 自定义 API 根路径（baseUrl）以及接口路径配置 */
  apiConfig?: DashboardSdkApiConfig;
  /**
   * 选择 API 的实现方式（实现层），默认使用 `mock`
   *
   * 说明：
   * - 在后端接口未就绪前，默认走 mock 数据，保证前端开发不被阻塞
   * - `http` 预留入口：即便内部实现不同，调用层的方法名保持稳定
   */
  apiKind?: ApiImplementationKind;
  /**
   * 直接传入一个完整的 apiClient（优先级高于 apiKind + apiConfig）
   *
   * 适用场景：
   * - 宿主应用已自行管理鉴权/请求/环境切换
   * - 需要在运行时切换不同数据源或不同后端实例
   */
  apiClient?: GrafanaFastApiClient;
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
 * - **轻量**：大对象（dashboard JSON）不放在 state 里；通过 `getDashboardSnapshot()` 按需拉取
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
   * - 宿主若确需全量变量状态，可在检测到该值变化后再调用 `getVariablesSnapshot()`
   */
  variablesRevision: number;
  /**
   * dashboard 内容变更代际（单调递增）
   *
   * 用途：
   * - 让宿主侧无需 deep-watch 大对象，就能知道 dashboard JSON 是否发生变化
   * - 宿主若确需全量 JSON，可在检测到该值变化后再调用 `getDashboardSnapshot()`
   */
  dashboardRevision: number;
}

export interface DashboardSdkApiConfig {
  /** API 根路径，例如 `/api`，用于拼接 endpoints */
  baseUrl?: string;
  /** 自定义 endpoints 覆盖（未提供的项会使用 DEFAULT_DASHBOARD_ENDPOINTS） */
  endpoints?: Partial<Record<DashboardApi, string>>;
}

export interface ResolvedDashboardSdkApiConfig {
  baseUrl: string;
  endpoints: Record<DashboardApi, string>;
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
  /** 手动挂载 Dashboard（一般由 SDK 自动触发；高级用法/调试用途） */
  mountDashboard: () => void;
  /** 手动卸载 Dashboard（用于释放资源/重置；高级用法/调试用途） */
  unmountDashboard: () => void;
  /** 按 dashboardId（资源标识）加载 dashboard 内容（不做历史 schema 迁移，依赖后端/宿主保证结构正确） */
  loadDashboard: (id: ID) => Promise<void>;
  /** 保存当前 dashboard（落库或写回后端/本地实现） */
  saveDashboard: () => Promise<void>;
  /** 直接替换当前 dashboard（导入/回放/压测） */
  setDashboard: (dashboard: DashboardContent, options?: { markAsSynced?: boolean }) => void;
  /** 新增面板组 */
  addPanelGroup: (group: Partial<PanelGroup>) => unknown;
  /** 更新面板组（标题/描述/折叠等） */
  updatePanelGroup: (id: ID, updates: Partial<PanelGroup>) => unknown;
  /** 删除面板组 */
  deletePanelGroup: (id: ID) => unknown;
  /** 更新面板组布局（拖拽/缩放后同步） */
  updatePanelGroupLayout: (groupId: ID, layout: PanelLayout[]) => unknown;
  /** 复制面板（用于快速创建相似面板） */
  duplicatePanel: (groupId: ID, panelId: ID) => unknown;
  /** 切换面板全屏查看（viewPanel） */
  togglePanelView: (groupId: ID, panelId: ID) => unknown;
  /** 通过 id 获取面板组快照（用于只读查询；不会泄漏内部引用） */
  getPanelGroupById: (id: ID) => PanelGroup | null;
  /** 通过 groupId + panelId 获取面板快照（用于只读查询；不会泄漏内部引用） */
  getPanelById: (groupId: ID, panelId: ID) => Panel | null;
  /** 设置时间范围（会触发相关面板刷新） */
  setTimeRange: (range: TimeRange) => unknown;
  /** 设置刷新间隔（ms，0 表示关闭自动刷新） */
  setRefreshInterval: (interval: number) => unknown;
  /** 主动触发一次刷新（按当前 timeRange/变量执行） */
  refreshTimeRange: () => unknown;
  /** 注册图表到全局 Tooltip（用于跨图表联动/固定 tooltip） */
  registerChart: (...args: any[]) => unknown;
  /** 更新已注册图表的信息（容器尺寸、offset 等） */
  updateChartRegistration: (...args: any[]) => unknown;
  /** 取消注册图表 */
  unregisterChart: (...args: any[]) => unknown;
  /** 手动写入全局鼠标位置（通常由 chart 事件驱动） */
  setGlobalMousePosition: (pos: MousePosition) => unknown;
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
  /** 刷新当前可视区域（viewport + overscan） */
  refreshVisiblePanels: () => void;
  /** 清空查询缓存（下次刷新会强制重新拉取） */
  invalidateQueryCache: () => void;

  /** 打开 Dashboard 右侧“设置/工具栏”侧边栏 */
  openSettings: () => void;
  /** 关闭 Dashboard 右侧“设置/工具栏”侧边栏 */
  closeSettings: () => void;
  /** 切换 Dashboard 右侧“设置/工具栏”侧边栏 */
  toggleSettings: () => void;
  /**
   * 通过 DashboardToolbar 暴露的 UI API（用于宿主侧“外部控制”）
   * - 注意：这些操作依赖 Dashboard 组件实例已挂载
   */
  toolbar: {
    openJsonModal: (mode?: 'view' | 'edit') => void;
    closeJsonModal: () => void;
    refresh: () => void;
    save: () => void;
    togglePanelsView: () => void;
    addPanelGroup: () => void;
    exportJson: () => void;
    importJson: () => void;
    viewJson: () => void;
    applyJson: () => void;
    setTimeRangePreset: (preset: string) => void;
  };
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
  /** 获取当前 dashboard JSON 的深拷贝（可能很大，建议按需调用）。 */
  getDashboardSnapshot: () => DashboardContent | null;
  /** 获取当前 variables 运行时状态快照（可被外部安全修改，不会影响内部）。 */
  getVariablesSnapshot: () => VariablesState;
  /** 获取指定面板组的深拷贝快照。 */
  getPanelGroupSnapshot: (id: ID) => PanelGroup | null;
  /** 获取指定面板的深拷贝快照。 */
  getPanelSnapshot: (groupId: ID, panelId: ID) => Panel | null;
  /** 获取解析后的 API 配置（baseUrl + endpoints 完整 URL）。 */
  getApiConfig: () => ResolvedDashboardSdkApiConfig;

  /** 命令式操作集合（宿主修改内部的唯一支持方式）。 */
  actions: DashboardSdkActions;
}
