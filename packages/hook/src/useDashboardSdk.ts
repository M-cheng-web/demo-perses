/**
 * 文件说明：Dashboard SDK（useDashboardSdk）
 *
 * 作用：
 * - 为宿主应用提供“嵌入式 dashboard”的统一挂载能力
 * - 提供 pinia 隔离策略、theme 管理、load/save 操作包装等
 *
 * 说明：
 * - 这是对外导出的核心 API 文件之一，因此注释会相对更完整
 */
import { createApp, defineComponent, h, onMounted, onUnmounted, ref, toRaw, watch, type App, type Ref } from 'vue';
import { createPinia } from '@grafana-fast/store';
import type { Dashboard, Panel, PanelGroup, PanelLayout, ID, TimeRange, VariablesState } from '@grafana-fast/types';
import {
  DashboardView,
  disposePiniaQueryScheduler,
  getPiniaQueryScheduler,
  getStoredThemePreference,
  setDashboardThemePreference,
  setPiniaApiClient,
  useDashboardStore,
  useTimeRangeStore,
  useTooltipStore,
  useVariablesStore,
  type DashboardTheme,
  type DashboardThemePreference,
  type MousePosition,
} from '@grafana-fast/dashboard';
import {
  createHttpApiClient,
  createMockApiClient,
  HttpApiEndpointKey,
  DEFAULT_HTTP_API_ENDPOINTS,
  type ApiImplementationKind,
  type GrafanaFastApiClient,
} from '@grafana-fast/api';
import { createPrefixedId, deepCloneStructured, url } from '@grafana-fast/utils';
import { createEmitter, type Unsubscribe } from './emitter';

const DEFAULT_BASE_URL = '/api';

/**
 * DashboardApi（对外导出）
 *
 * 说明：
 * - 这里保持原来的 export 名称（DashboardApi / DEFAULT_DASHBOARD_ENDPOINTS），避免上层改动
 * - 但内部实现改为复用 @grafana-fast/api 的 HttpApiEndpointKey/DEFAULT_HTTP_API_ENDPOINTS：
 *   - endpoint key 统一来源，避免 dashboard/hook/api 三处各写一份导致不一致
 *   - 未来接入真实后端时，主要在 @grafana-fast/api 的 http 实现层维护路径与 DTO 适配
 */
export const DashboardApi = HttpApiEndpointKey;
export type DashboardApi = HttpApiEndpointKey;
export const DEFAULT_DASHBOARD_ENDPOINTS: Record<DashboardApi, string> = DEFAULT_HTTP_API_ENDPOINTS;

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
  id: ID;
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

export interface DashboardQuerySchedulerDebugTask {
  panelId: string;
  priority: number;
  reason: string;
  ageMs: number;
}

/**
 * QueryScheduler 调试快照（稳定结构 + 可深拷贝）
 *
 * 说明：
 * - 这里刻意不暴露 scheduler 实例（否则会打破 SDK 边界）
 * - 仅提供一个“稳定数据结构”的快照，用于宿主页面展示/调试
 */
export interface DashboardQuerySchedulerSnapshot {
  updatedAt: number;
  conditionGeneration: number;
  queueGeneration: number;
  registeredPanels: number;
  visiblePanels: number;
  pendingTasks: number;
  inflightPanels: number;
  maxPanelConcurrency: number;
  runnerMaxConcurrency: number;
  runnerCacheTtlMs: number;
  topPending: DashboardQuerySchedulerDebugTask[];
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
  /** 按 id 加载 dashboard（不做历史 schema 迁移，依赖后端/宿主保证结构正确） */
  loadDashboard: (id: ID) => Promise<void>;
  /** 保存当前 dashboard（落库或写回后端/本地实现） */
  saveDashboard: () => Promise<void>;
  /** 直接替换当前 dashboard（导入/回放/压测） */
  setDashboard: (dashboard: Dashboard, options?: { markAsSynced?: boolean }) => void;
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

  /** QueryScheduler 监控快照（稳定数据结构，不暴露 scheduler 实例） */
  getQuerySchedulerSnapshot: () => DashboardQuerySchedulerSnapshot;
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
  getDashboardSnapshot: () => Dashboard | null;
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

// 重要：SDK 总是创建“隔离的 pinia 实例”，避免把内部状态泄漏给宿主应用。

/**
 * 将 Dashboard 渲染到指定容器并暴露状态/操作
 * @param targetRef 要挂载 Dashboard 的容器 ref
 * @param options   配置项（dashboardId、接口路径、生命周期钩子等）
 */
export function useDashboardSdk(targetRef: Ref<HTMLElement | null>, options: DashboardSdkOptions = {}): UseDashboardSdkResult {
  const emitter = createEmitter<DashboardSdkEventMap>();

  // SDK 始终使用隔离的 pinia，防止宿主通过 store 引用直接篡改内部状态。
  const pinia = createPinia();
  // 重要：标记该 pinia 为 “SDK 挂载专用”。
  // DashboardView（对外导出的组件）会在未检测到该标记时拒绝加载（防止直接用组件方式集成）。
  (pinia as any).__gfDashboardSdkMount = true;

  const emitError = (error: unknown) => {
    emitter.emit('error', { error });
    options.onError?.(error);
  };

  // 解析 apiClient：默认使用 mock（后端接口未就绪时不阻塞前端）
  const resolvedApiClient: GrafanaFastApiClient =
    options.apiClient ?? (options.apiKind === 'http' ? createHttpApiClient({ apiConfig: options.apiConfig }) : createMockApiClient());

  // 把 runtime 依赖挂到 pinia 实例上，让 dashboard 内部 store 可以在“无全局单例”的情况下获取到 apiClient
  setPiniaApiClient(pinia, resolvedApiClient);

  const dashboardStore = useDashboardStore(pinia);
  const timeRangeStore = useTimeRangeStore(pinia);
  const tooltipStore = useTooltipStore(pinia);
  const variablesStore = useVariablesStore(pinia);

  const containerSize = ref({ width: 0, height: 0 });
  const ready = ref(false);
  const dashboardApp = ref<App<Element> | null>(null);
  const themePreference = ref<DashboardThemePreference>('system');
  const theme = ref<DashboardTheme>('light');
  const themePersist = options.persistThemePreference === true;
  const themeApplyToDocument = options.applyThemeToDocument === true;
  const instanceId = options.instanceId ?? `sdk-${resolvedApiClient.kind}-${createPrefixedId('dash')}`;
  const dashboardViewRef = ref<any>(null);
  const isDashboardMounted = ref(false);

  // 在首次渲染前应用 readOnly（仅写入 store；不走 props-driven 同步）。
  dashboardStore.setReadOnly(options.readOnly === true);

  const resolveApiConfig = (): ResolvedDashboardSdkApiConfig => {
    const baseUrl = url.normalizeBase(options.apiConfig?.baseUrl ?? DEFAULT_BASE_URL);
    const overrides = options.apiConfig?.endpoints ?? {};
    const endpoints: Record<DashboardApi, string> = { ...DEFAULT_DASHBOARD_ENDPOINTS, ...overrides };
    const resolved: Record<DashboardApi, string> = Object.fromEntries(
      Object.entries(endpoints).map(([key, value]) => {
        const normalized = url.resolveEndpoint(baseUrl, value);
        return [key as DashboardApi, normalized];
      })
    ) as Record<DashboardApi, string>;
    return { baseUrl, endpoints: resolved };
  };
  const resolvedApiConfig = resolveApiConfig();

  const getDashboardSummary = (): DashboardSdkDashboardSummary | null => {
    const dash = dashboardStore.currentDashboard;
    if (!dash) return null;
    const groups = dash.panelGroups ?? [];
    let panelCount = 0;
    for (const g of groups) panelCount += g.panels?.length ?? 0;
    return {
      id: dash.id,
      name: dash.name,
      groupCount: groups.length,
      panelCount,
    };
  };

  const getDashboardRevision = (): number => {
    const raw = Number((dashboardStore as any).dashboardContentRevision ?? 0);
    return Number.isFinite(raw) ? Math.floor(raw) : 0;
  };

  const getState = (): DashboardSdkStateSnapshot => {
    const timeRange = deepCloneStructured(toRaw(timeRangeStore.timeRange));
    const rawViewPanelId = ((dashboardStore as any).viewPanelId ?? null) as { groupId: ID; panelId: ID } | null;
    const viewPanelId = rawViewPanelId ? (deepCloneStructured(toRaw(rawViewPanelId)) as { groupId: ID; panelId: ID }) : null;
    return {
      instanceId,
      mounted: !!isDashboardMounted.value,
      ready: !!ready.value,
      containerSize: { ...containerSize.value },
      theme: theme.value,
      themePreference: themePreference.value,
      readOnly: !!dashboardStore.isReadOnly,
      viewMode: (dashboardStore.viewMode as DashboardSdkViewMode) ?? 'grouped',
      isBooting: !!dashboardStore.isBooting,
      bootStage: (dashboardStore.bootStage as DashboardSdkBootStage) ?? 'idle',
      isSaving: !!dashboardStore.isSaving,
      isSyncing: !!dashboardStore.isSyncing,
      hasUnsyncedChanges: !!dashboardStore.hasUnsyncedChanges,
      lastError: dashboardStore.lastError ?? null,
      timeRange: timeRange as TimeRange,
      viewPanelId,
      dashboard: getDashboardSummary(),
      variablesRevision: Number(variablesStore.valuesGeneration ?? 0) || 0,
      dashboardRevision: getDashboardRevision(),
    };
  };

  const getDashboardSnapshot = (): Dashboard | null => {
    const snap = dashboardStore.getPersistableDashboardSnapshot?.() ?? dashboardStore.currentDashboard;
    if (!snap) return null;
    return deepCloneStructured(toRaw(snap));
  };

  const getVariablesSnapshot = (): VariablesState => {
    try {
      return deepCloneStructured(toRaw(variablesStore.state)) as VariablesState;
    } catch {
      return { values: {}, options: {}, lastUpdatedAt: Date.now() };
    }
  };

  const getPanelGroupSnapshot = (id: ID): PanelGroup | null => {
    const group = dashboardStore.getPanelGroupById(id) as PanelGroup | undefined;
    if (!group) return null;
    return deepCloneStructured(toRaw(group));
  };

  const getPanelSnapshot = (groupId: ID, panelId: ID): Panel | null => {
    const panel = dashboardStore.getPanelById(groupId, panelId) as Panel | undefined;
    if (!panel) return null;
    return deepCloneStructured(toRaw(panel));
  };

  let changeEmitQueued = false;
  let lastEmittedState: DashboardSdkStateSnapshot | null = null;

  const isSameTimeRange = (a: TimeRange, b: TimeRange) => {
    const af = String((a as any)?.from ?? '');
    const at = String((a as any)?.to ?? '');
    const bf = String((b as any)?.from ?? '');
    const bt = String((b as any)?.to ?? '');
    return af === bf && at === bt;
  };

  const isSameViewPanelId = (a: DashboardSdkStateSnapshot['viewPanelId'], b: DashboardSdkStateSnapshot['viewPanelId']) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a.groupId) === String(b.groupId) && String(a.panelId) === String(b.panelId);
  };

  const isSameDashboardSummary = (a: DashboardSdkDashboardSummary | null, b: DashboardSdkDashboardSummary | null) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a.id) === String(b.id) && a.name === b.name && a.groupCount === b.groupCount && a.panelCount === b.panelCount;
  };

  const computeChangedKeys = (prev: DashboardSdkStateSnapshot | null, next: DashboardSdkStateSnapshot): Array<keyof DashboardSdkStateSnapshot> => {
    if (!prev) return Object.keys(next) as Array<keyof DashboardSdkStateSnapshot>;

    const changed: Array<keyof DashboardSdkStateSnapshot> = [];
    const mark = (key: keyof DashboardSdkStateSnapshot, same: boolean) => {
      if (!same) changed.push(key);
    };

    mark('instanceId', prev.instanceId === next.instanceId);
    mark('mounted', prev.mounted === next.mounted);
    mark('ready', prev.ready === next.ready);
    mark('containerSize', prev.containerSize.width === next.containerSize.width && prev.containerSize.height === next.containerSize.height);
    mark('theme', prev.theme === next.theme);
    mark('themePreference', prev.themePreference === next.themePreference);
    mark('readOnly', prev.readOnly === next.readOnly);
    mark('viewMode', prev.viewMode === next.viewMode);
    mark('isBooting', prev.isBooting === next.isBooting);
    mark('bootStage', prev.bootStage === next.bootStage);
    mark('isSaving', prev.isSaving === next.isSaving);
    mark('isSyncing', prev.isSyncing === next.isSyncing);
    mark('hasUnsyncedChanges', prev.hasUnsyncedChanges === next.hasUnsyncedChanges);
    mark('lastError', prev.lastError === next.lastError);
    mark('timeRange', isSameTimeRange(prev.timeRange, next.timeRange));
    mark('viewPanelId', isSameViewPanelId(prev.viewPanelId, next.viewPanelId));
    mark('dashboard', isSameDashboardSummary(prev.dashboard, next.dashboard));
    mark('variablesRevision', prev.variablesRevision === next.variablesRevision);
    mark('dashboardRevision', prev.dashboardRevision === next.dashboardRevision);

    return changed;
  };

  const emitChange = () => {
    const next = getState();
    const prev = lastEmittedState;
    const changedKeys = computeChangedKeys(prev, next);
    const dashboardChanged = prev ? prev.dashboardRevision !== next.dashboardRevision : true;
    // 存一份内部副本：即便宿主错误地修改了事件回调拿到的快照对象，
    // 也不会影响下一次 diff 的比较逻辑（避免“外部污染内部对比基线”）。
    lastEmittedState = deepCloneStructured(next);
    emitter.emit('change', { at: Date.now(), state: next, prevState: prev, changedKeys, dashboardChanged });
  };

  const scheduleChange = () => {
    if (changeEmitQueued) return;
    changeEmitQueued = true;
    queueMicrotask(() => {
      changeEmitQueued = false;
      emitChange();
    });
  };

  const DashboardSdkRoot = defineComponent({
    name: 'DashboardSdkRoot',
    setup() {
      return () =>
        h(DashboardView, {
          ref: dashboardViewRef,
          theme: theme.value,
          portalTarget: options.portalTarget ?? null,
          apiClient: resolvedApiClient,
          instanceId,
        });
    },
  });

  const updateSize = () => {
    const el = targetRef.value;
    if (!el) return;
    const next = { width: el.clientWidth, height: el.clientHeight };
    if (next.width === containerSize.value.width && next.height === containerSize.value.height) return;
    containerSize.value = next;
    scheduleChange();
  };

  let resizeObserver: ResizeObserver | null = null;

  const mountDashboard = () => {
    if (dashboardApp.value || !targetRef.value || isDashboardMounted.value) return;
    const app = createApp(DashboardSdkRoot);
    app.use(pinia as any);
    app.mount(targetRef.value);
    dashboardApp.value = app;
    isDashboardMounted.value = true;
    scheduleChange();
  };

  const unmountDashboard = () => {
    if (dashboardApp.value && isDashboardMounted.value) {
      dashboardApp.value.unmount();
      dashboardApp.value = null;
      isDashboardMounted.value = false;
      scheduleChange();
    }
  };

  watch(
    targetRef,
    (el, prevEl, onCleanup) => {
      // 容器变化时重绑 ResizeObserver
      if (resizeObserver && prevEl) {
        resizeObserver.unobserve(prevEl);
      }

      if (el) {
        resizeObserver?.observe(el);
        updateSize();

        if (dashboardApp.value && prevEl !== el) {
          unmountDashboard();
          mountDashboard();
        }
      }

      onCleanup(() => {
        if (resizeObserver && el) resizeObserver.unobserve(el);
      });
    },
    { immediate: true }
  );

  onMounted(async () => {
    resizeObserver = new ResizeObserver(updateSize);
    if (targetRef.value) {
      resizeObserver.observe(targetRef.value);
      updateSize();
    }

    try {
      // 尽可能早初始化主题：保证第一次渲染前 token/变量已就绪
      const storedPreference = themePersist ? getStoredThemePreference() : null;
      themePreference.value = options.themePreference ?? storedPreference ?? 'system';
      // 默认不修改宿主 document；如需全站主题接管，可通过 applyThemeToDocument 开启
      theme.value = setDashboardThemePreference(themePreference.value, { persist: themePersist, apply: themeApplyToDocument });

      mountDashboard();
      if (options.autoLoad !== false && !dashboardStore.currentDashboard) {
        await dashboardStore.loadDashboard(options.dashboardId ?? 'default');
      }

      ready.value = true;
      scheduleChange();
      options.onReady?.();
    } catch (error) {
      emitError(error);
    }
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;

    // 卸载时要停止后台刷新，避免内存泄漏或多实例互相影响
    try {
      (timeRangeStore as any).stopAutoRefresh?.();
    } catch {
      // 忽略：不影响卸载流程
    }

    try {
      disposePiniaQueryScheduler(pinia);
    } catch {
      // 忽略：不影响卸载流程
    }

    options.onBeforeUnmount?.();
    unmountDashboard();
    emitter.clear();
  });

  // 轻量级“public 快照变化跟踪”：避免 deep watch dashboard 大对象。
  watch(
    [
      () => dashboardStore.isReadOnly,
      () => dashboardStore.viewMode,
      () => dashboardStore.isBooting,
      () => dashboardStore.bootStage,
      () => dashboardStore.isSaving,
      () => dashboardStore.isSyncing,
      () => dashboardStore.hasUnsyncedChanges,
      () => dashboardStore.lastError,
      () => (dashboardStore as any).editingGroupId,
      () => (dashboardStore as any).viewPanelId,
      () => timeRangeStore.timeRange.from,
      () => timeRangeStore.timeRange.to,
      () => variablesStore.valuesGeneration,
      () => theme.value,
      () => themePreference.value,
      () => getDashboardRevision(),
    ],
    () => scheduleChange(),
    { immediate: true }
  );

  const actions: DashboardSdkActions = {
    mountDashboard: () => mountDashboard(),
    unmountDashboard: () => unmountDashboard(),
    // Dashboard 数据加载/保存
    loadDashboard: async (id: ID) => {
      try {
        await dashboardStore.loadDashboard(id);
        scheduleChange();
      } catch (error) {
        emitError(error);
        throw error;
      }
    },
    saveDashboard: async () => {
      try {
        await dashboardStore.saveDashboard();
        scheduleChange();
      } catch (error) {
        emitError(error);
        throw error;
      }
    },
    setDashboard: (dashboard: Dashboard, opts?: { markAsSynced?: boolean }) => {
      const next = deepCloneStructured(dashboard);

      // 优先使用 store 提供的 replaceDashboard：把一致性约束收敛在 store 层（更可靠）。
      const replace = (dashboardStore as any).replaceDashboard as undefined | ((d: Dashboard, o?: any) => void);
      if (typeof replace === 'function') {
        replace(next, { markAsSynced: opts?.markAsSynced !== false });
      } else {
        // 兜底：兼容旧版本 store（尽力重置关键 UI 状态）。
        (dashboardStore as any).cancelPendingSync?.();
        dashboardStore.currentDashboard = next;
        (dashboardStore as any).editingGroupId = null;
        (dashboardStore as any).viewPanelId = null;
        dashboardStore.viewMode = 'grouped' as any;
        if (opts?.markAsSynced !== false) {
          (dashboardStore as any).markSyncedFromCurrent?.();
        } else {
          dashboardStore.hasUnsyncedChanges = true;
        }
      }

      scheduleChange();
    },
    // 面板组管理
    addPanelGroup: (group: Partial<PanelGroup>) => dashboardStore.addPanelGroup(group),
    updatePanelGroup: (id: ID, updates: Partial<PanelGroup>) => dashboardStore.updatePanelGroup(id, updates),
    deletePanelGroup: (id: ID) => dashboardStore.deletePanelGroup(id),
    updatePanelGroupLayout: (groupId: ID, layout: PanelLayout[]) => dashboardStore.updatePanelGroupLayout(groupId, layout),
    // 面板管理
    duplicatePanel: (groupId: ID, panelId: ID) => dashboardStore.duplicatePanel(groupId, panelId),
    togglePanelView: (groupId: ID, panelId: ID) => dashboardStore.togglePanelView(groupId, panelId),
    getPanelGroupById: (id: ID) => getPanelGroupSnapshot(id),
    getPanelById: (groupId: ID, panelId: ID) => getPanelSnapshot(groupId, panelId),
    // 时间范围
    setTimeRange: (range: TimeRange) => timeRangeStore.setTimeRange(deepCloneStructured(range)),
    setRefreshInterval: (interval: number) => timeRangeStore.setRefreshInterval(interval),
    refreshTimeRange: () => timeRangeStore.refresh(),
    // Tooltip 联动
    registerChart: tooltipStore.registerChart,
    updateChartRegistration: tooltipStore.updateChartRegistration,
    unregisterChart: tooltipStore.unregisterChart,
    setGlobalMousePosition: tooltipStore.updateGlobalMousePosition,

    getTheme: () => theme.value,
    setTheme: (next: DashboardTheme) => {
      themePreference.value = next;
      theme.value = setDashboardThemePreference(next, { persist: themePersist, apply: themeApplyToDocument });
      scheduleChange();
      return theme.value;
    },
    setThemePreference: (preference: DashboardThemePreference) => {
      themePreference.value = preference;
      theme.value = setDashboardThemePreference(preference, { persist: themePersist, apply: themeApplyToDocument });
      scheduleChange();
      return theme.value;
    },
    toggleTheme: () => {
      const next = theme.value === 'dark' ? 'light' : 'dark';
      themePreference.value = next;
      theme.value = setDashboardThemePreference(next, { persist: themePersist, apply: themeApplyToDocument });
      scheduleChange();
      return theme.value;
    },

    setReadOnly: (ro: boolean) => {
      dashboardStore.setReadOnly(!!ro);
      scheduleChange();
    },

    setVariableValue: (name: string, value: string | string[]) => {
      try {
        variablesStore.setValue(name, value);
        scheduleChange();
      } catch (error) {
        emitError(error);
      }
    },
    setVariableValues: (values: Record<string, string | string[]>) => {
      try {
        variablesStore.setValues(values);
        scheduleChange();
      } catch (error) {
        emitError(error);
      }
    },
    refreshVariableOptions: () => {
      try {
        void variablesStore.resolveOptions();
      } catch (error) {
        emitError(error);
      }
    },

    // QueryScheduler（仅当前 SDK 实例可见）
    getQuerySchedulerSnapshot: () => {
      const empty = (): DashboardQuerySchedulerSnapshot => ({
        updatedAt: Date.now(),
        conditionGeneration: 0,
        queueGeneration: 0,
        registeredPanels: 0,
        visiblePanels: 0,
        pendingTasks: 0,
        inflightPanels: 0,
        maxPanelConcurrency: 0,
        runnerMaxConcurrency: 0,
        runnerCacheTtlMs: 0,
        topPending: [],
      });

      try {
        const scheduler = getPiniaQueryScheduler(pinia) as any;
        const snap = scheduler?.getDebugSnapshot ? scheduler.getDebugSnapshot() : (scheduler?.debug?.value ?? null);
        if (!snap) return empty();
        return deepCloneStructured(toRaw(snap)) as DashboardQuerySchedulerSnapshot;
      } catch (error) {
        emitError(error);
        return empty();
      }
    },
    refreshVisiblePanels: () => {
      try {
        const scheduler = getPiniaQueryScheduler(pinia) as any;
        scheduler?.refreshVisible?.();
      } catch (error) {
        emitError(error);
      }
    },
    invalidateQueryCache: () => {
      try {
        const scheduler = getPiniaQueryScheduler(pinia) as any;
        scheduler?.invalidateAll?.();
      } catch (error) {
        emitError(error);
      }
    },

    openSettings: () => dashboardViewRef.value?.openSettings?.(),
    closeSettings: () => dashboardViewRef.value?.closeSettings?.(),
    toggleSettings: () => dashboardViewRef.value?.toggleSettings?.(),
    toolbar: {
      openJsonModal: (mode: 'view' | 'edit' = 'view') => dashboardViewRef.value?.toolbar?.openJsonModal?.(mode),
      closeJsonModal: () => dashboardViewRef.value?.toolbar?.closeJsonModal?.(),
      refresh: () => dashboardViewRef.value?.toolbar?.refresh?.(),
      save: () => dashboardViewRef.value?.toolbar?.save?.(),
      togglePanelsView: () => dashboardViewRef.value?.toolbar?.togglePanelsView?.(),
      addPanelGroup: () => dashboardViewRef.value?.toolbar?.addPanelGroup?.(),
      exportJson: () => dashboardViewRef.value?.toolbar?.exportJson?.(),
      importJson: () => dashboardViewRef.value?.toolbar?.importJson?.(),
      viewJson: () => dashboardViewRef.value?.toolbar?.viewJson?.(),
      applyJson: () => dashboardViewRef.value?.toolbar?.applyJson?.(),
      setTimeRangePreset: (preset: string) => dashboardViewRef.value?.toolbar?.setTimeRangePreset?.(preset),
    },
  };

  return {
    on: emitter.on,
    off: emitter.off,
    getState,
    getDashboardSnapshot,
    getVariablesSnapshot,
    getPanelGroupSnapshot,
    getPanelSnapshot,
    getApiConfig: () => deepCloneStructured(resolvedApiConfig),
    actions,
  };
}
