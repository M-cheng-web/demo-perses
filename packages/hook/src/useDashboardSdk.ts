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
import { computed, createApp, defineComponent, h, onMounted, onUnmounted, ref, watch, type App, type ComputedRef, type Ref } from 'vue';
import { createPinia, getActivePinia, setActivePinia } from '@grafana-fast/store';
import type { Pinia } from '@grafana-fast/store';
import type { Dashboard, Panel, PanelGroup, PanelLayout, ID, TimeRange } from '@grafana-fast/types';
import {
  initDashboardTheme,
  getStoredThemePreference,
  setDashboardThemePreference,
  type DashboardTheme,
  type DashboardThemePreference,
  useDashboardStore,
  useTimeRangeStore,
  useTooltipStore,
  type MousePosition,
  type TooltipData,
} from '@grafana-fast/dashboard';
import { DashboardView } from '@grafana-fast/dashboard';
import {
  createHttpApiClient,
  createMockApiClient,
  createPrometheusDirectApiClient,
  HttpApiEndpointKey,
  DEFAULT_HTTP_API_ENDPOINTS,
  type ApiImplementationKind,
  type GrafanaFastApiClient,
} from '@grafana-fast/api';
import { setPiniaApiClient, disposePiniaQueryScheduler } from '@grafana-fast/dashboard';
import { createPrefixedId, url } from '@grafana-fast/utils';

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
  /** 可选 pinia 实例，默认取当前 active pinia 或自动创建 */
  pinia?: Pinia;
  /** 是否自动加载 dashboard 数据，默认为 true */
  autoLoad?: boolean;
  /** 自定义 API 根路径（baseUrl）以及接口路径配置 */
  apiConfig?: DashboardSdkApiConfig;
  /**
   * 选择 API 的实现方式（实现层），默认使用 `mock`
   *
   * 说明：
   * - 在后端接口未就绪前，默认走 mock 数据，保证前端开发不被阻塞
   * - `http` / `prometheus-direct` 先预留入口：即便内部实现不同，调用层的方法名保持稳定
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
  /**
   * Pinia 实例隔离策略（用于同一页面挂载多个 dashboard 的场景）
   *
   * - `isolate`（默认）：当未传入 options.pinia 时，自动创建新的 pinia 实例，实现 store/调度器/tooltip 等隔离
   * - `shared`：优先复用当前 active pinia（如果存在），适合“全站共享 store”场景
   */
  piniaStrategy?: 'isolate' | 'shared';
  /** SDK 准备好后触发 */
  onReady?: () => void;
  /** SDK 释放前触发 */
  onBeforeUnmount?: () => void;
  /** 异常回调 */
  onError?: (error: unknown) => void;
}

export interface DashboardSdkState {
  /** 当前 dashboard 数据 */
  dashboard: Dashboard | null;
  /** 面板组集合 */
  panelGroups: PanelGroup[];
  /** 是否处于编辑模式 */
  isEditMode: boolean;
  /** 当前全屏查看的面板 */
  viewPanel: Panel | null;
  /** 当前时间范围 */
  timeRange: TimeRange;
  /** 全局 Tooltip 数据 */
  tooltip: TooltipData | null;
  /** 全局鼠标位置（用于 Tooltip 联动） */
  mousePosition: MousePosition | null;
  /** 当前主题（light/dark） */
  theme: DashboardTheme;
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

export interface DashboardSdkActions {
  /** 按 id 加载 dashboard（不做历史 schema 迁移，依赖后端/宿主保证结构正确） */
  loadDashboard: (id: ID) => Promise<unknown>;
  /** 保存当前 dashboard（落库或写回后端/本地实现） */
  saveDashboard: () => Promise<unknown>;
  /** 直接替换当前 dashboard（导入/回放/压测） */
  setDashboard: (dashboard: Dashboard) => void;
  /** 切换编辑模式（影响拖拽/操作按钮/编辑器等） */
  toggleEditMode: () => void;
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
  /** 通过 id 获取面板组（用于只读查询） */
  getPanelGroupById: (id: ID) => unknown;
  /** 通过 groupId + panelId 获取面板（用于只读查询） */
  getPanelById: (groupId: ID, panelId: ID) => unknown;
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
}

export interface UseDashboardSdkResult {
  /** SDK 使用的 pinia 实例（可用于与宿主应用共享或隔离） */
  pinia: Pinia;
  /** SDK 是否已完成挂载与初始化 */
  ready: Ref<boolean>;
  /** Dashboard 挂载目标容器 ref */
  targetRef: Ref<HTMLElement | null>;
  /** 容器尺寸（用于响应式布局、resize 触发等） */
  containerSize: Ref<{ width: number; height: number }>;
  /** 聚合后的只读状态（对外稳定形态） */
  state: ComputedRef<DashboardSdkState>;
  /** 解析后的 API 配置（baseUrl + endpoints 完整 URL），方便调试 */
  api: ComputedRef<ResolvedDashboardSdkApiConfig>;
  /** 对外操作集合（稳定 API 面） */
  actions: DashboardSdkActions;
  /** 当前实际主题（light/dark） */
  theme: Ref<DashboardTheme>;
  /** 主题偏好（light/dark/system） */
  themePreference: Ref<DashboardThemePreference>;
  /** 手动挂载（一般由 SDK 自动触发；高级用法） */
  mountDashboard: () => void;
  /** 手动卸载（用于释放资源/重置） */
  unmountDashboard: () => void;
  /**
   * 高级/调试用途：直接拿到内部 store 实例
   *
   * 说明：
   * - 这里刻意标为 `unknown`，避免把内部 store 结构当成“稳定对外 API”
   * - 对外推荐使用 `state` + `actions`（更稳定、可做兼容层）
   */
  dashboardStore: unknown;
  timeRangeStore: unknown;
  tooltipStore: unknown;
}

function ensurePinia(pinia: Pinia | undefined, strategy: 'isolate' | 'shared') {
  if (pinia) {
    // 外部传入实例时，直接设为当前激活实例
    setActivePinia(pinia);
    return pinia;
  }

  // 默认行为（多实例隔离）：
  // 未传 pinia 时，除非显式选择 shared，否则创建新的 pinia 实例用于隔离多个 dashboard。
  if (strategy === 'shared') {
    const active = getActivePinia();
    if (active) return active;
  }

  const created = createPinia();
  setActivePinia(created);
  return created;
}

/**
 * 将 Dashboard 渲染到指定容器并暴露状态/操作
 * @param targetRef 要挂载 Dashboard 的容器 ref
 * @param options   配置项（dashboardId、pinia、接口路径、生命周期钩子等）
 */
export function useDashboardSdk(targetRef: Ref<HTMLElement | null>, options: DashboardSdkOptions = {}): UseDashboardSdkResult {
  // 保证 Pinia 上下文存在
  const pinia = ensurePinia(options.pinia, options.piniaStrategy ?? 'isolate');

  // 解析 apiClient：默认使用 mock（后端接口未就绪时不阻塞前端）
  const resolvedApiClient: GrafanaFastApiClient =
    options.apiClient ??
    (options.apiKind === 'http'
      ? createHttpApiClient({ apiConfig: options.apiConfig })
      : options.apiKind === 'prometheus-direct'
        ? createPrometheusDirectApiClient({ apiConfig: options.apiConfig })
        : createMockApiClient());

  // 把 runtime 依赖挂到 pinia 实例上，让 dashboard 内部 store 可以在“无全局单例”的情况下获取到 apiClient
  setPiniaApiClient(pinia, resolvedApiClient);

  const dashboardStore = useDashboardStore(pinia);
  const timeRangeStore = useTimeRangeStore(pinia);
  const tooltipStore = useTooltipStore(pinia);

  const containerSize = ref({ width: 0, height: 0 });
  const ready = ref(false);
  const dashboardApp = ref<App<Element> | null>(null);
  const themePreference = ref<DashboardThemePreference>('system');
  const theme = ref<DashboardTheme>('light');
  const runtimeId = `sdk-${resolvedApiClient.kind}-${createPrefixedId('rt')}`;

  const DashboardSdkRoot = defineComponent({
    name: 'DashboardSdkRoot',
    setup() {
      return () =>
        h(DashboardView, {
          theme: theme.value,
          apiClient: resolvedApiClient,
          runtimeId,
        });
    },
  });

  const updateSize = () => {
    const el = targetRef.value;
    if (!el) return;
    containerSize.value = {
      width: el.clientWidth,
      height: el.clientHeight,
    };
  };

  let resizeObserver: ResizeObserver | null = null;

  // 将 baseUrl 与自定义 endpoints 合并为完整 URL，暴露给外部调试/使用
  const resolvedApiConfig = computed<ResolvedDashboardSdkApiConfig>(() => {
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
  });

  const isDashboardMounted = ref(false);

  const mountDashboard = () => {
    if (dashboardApp.value || !targetRef.value || isDashboardMounted.value) return;
    const app = createApp(DashboardSdkRoot);
    app.use(pinia as any);
    app.mount(targetRef.value);
    dashboardApp.value = app;
    isDashboardMounted.value = true;
  };

  // 卸载 Dashboard，可用于调试/重置
  const unmountDashboard = () => {
    if (dashboardApp.value && isDashboardMounted.value) {
      dashboardApp.value.unmount();
      dashboardApp.value = null;
      isDashboardMounted.value = false;
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
      themePreference.value = getStoredThemePreference() ?? 'system';
      theme.value = initDashboardTheme({ defaultPreference: themePreference.value });

      mountDashboard();
      if (options.autoLoad !== false && !dashboardStore.currentDashboard) {
        await dashboardStore.loadDashboard(options.dashboardId ?? 'default');
      }

      ready.value = true;
      options.onReady?.();
    } catch (error) {
      options.onError?.(error);
    }
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    // 隔离实例场景下，卸载时要停止后台刷新，避免内存泄漏或多实例互相影响
    try {
      (timeRangeStore as any).stopAutoRefresh?.();
    } catch {
      // ignore
    }
    if (!options.pinia && (options.piniaStrategy ?? 'isolate') === 'isolate') {
      try {
        disposePiniaQueryScheduler(pinia);
      } catch {
        // ignore
      }
    }
    options.onBeforeUnmount?.();
    unmountDashboard();
  });

  const state = computed<DashboardSdkState>(() => ({
    dashboard: dashboardStore.currentDashboard,
    panelGroups: dashboardStore.panelGroups,
    isEditMode: dashboardStore.isEditMode,
    viewPanel: dashboardStore.viewPanel,
    timeRange: timeRangeStore.timeRange,
    tooltip: tooltipStore.currentTooltipData,
    mousePosition: tooltipStore.currentPosition,
    theme: theme.value,
  }));

  const actions: DashboardSdkActions = {
    // Dashboard 数据加载/保存
    loadDashboard: (id: ID) => dashboardStore.loadDashboard(id),
    saveDashboard: () => dashboardStore.saveDashboard(),
    setDashboard: (dashboard: Dashboard) => {
      // 按当前策略：不做历史 schema 迁移；宿主传入的 dashboard 必须符合当前结构
      dashboardStore.currentDashboard = dashboard;
    },
    // 编辑模式切换
    toggleEditMode: () => dashboardStore.toggleEditMode(),
    // 面板组管理
    addPanelGroup: (group: Partial<PanelGroup>) => dashboardStore.addPanelGroup(group),
    updatePanelGroup: (id: ID, updates: Partial<PanelGroup>) => dashboardStore.updatePanelGroup(id, updates),
    deletePanelGroup: (id: ID) => dashboardStore.deletePanelGroup(id),
    updatePanelGroupLayout: (groupId: ID, layout: PanelLayout[]) => dashboardStore.updatePanelGroupLayout(groupId, layout),
    // 面板管理
    duplicatePanel: (groupId: ID, panelId: ID) => dashboardStore.duplicatePanel(groupId, panelId),
    togglePanelView: (groupId: ID, panelId: ID) => dashboardStore.togglePanelView(groupId, panelId),
    getPanelGroupById: (id: ID) => dashboardStore.getPanelGroupById(id),
    getPanelById: (groupId: ID, panelId: ID) => dashboardStore.getPanelById(groupId, panelId),
    // 时间范围
    setTimeRange: (range: TimeRange) => timeRangeStore.setTimeRange(range),
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
      theme.value = setDashboardThemePreference(next);
      return theme.value;
    },
    setThemePreference: (preference: DashboardThemePreference) => {
      themePreference.value = preference;
      theme.value = setDashboardThemePreference(preference);
      return theme.value;
    },
    toggleTheme: () => {
      const next = theme.value === 'dark' ? 'light' : 'dark';
      themePreference.value = next;
      theme.value = setDashboardThemePreference(next);
      return theme.value;
    },
  };

  // 对外暴露的状态、API 配置和操作
  return {
    pinia,
    ready,
    targetRef,
    containerSize,
    state,
    api: resolvedApiConfig,
    dashboardStore,
    timeRangeStore,
    tooltipStore,
    actions,
    theme,
    themePreference,
    mountDashboard,
    unmountDashboard,
  };
}
