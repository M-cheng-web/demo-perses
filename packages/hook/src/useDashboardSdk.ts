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

const DEFAULT_DSN = '/api';

export const DashboardApi = {
  /** GET /dashboards/:id - 获取单个 Dashboard */
  LoadDashboard: 'LoadDashboard',
  /** POST /dashboards - 保存 Dashboard */
  SaveDashboard: 'SaveDashboard',
  /** DELETE /dashboards/:id - 删除 Dashboard */
  DeleteDashboard: 'DeleteDashboard',
  /** GET /dashboards - 查询全部 Dashboard 列表 */
  AllDashboards: 'AllDashboards',
  /** GET /dashboards/default - 获取默认 Dashboard */
  DefaultDashboard: 'DefaultDashboard',
  /** POST /query/execute - 执行单条查询 */
  ExecuteQuery: 'ExecuteQuery',
  /** POST /queries/execute - 执行多条查询 */
  ExecuteQueries: 'ExecuteQueries',
  /** GET /datasources/:id - 获取数据源 */
  GetDatasource: 'GetDatasource',
  /** GET /datasources/default - 获取默认数据源 */
  DefaultDatasource: 'DefaultDatasource',
} as const;

export type DashboardApi = (typeof DashboardApi)[keyof typeof DashboardApi];

export const DEFAULT_DASHBOARD_ENDPOINTS: Record<DashboardApi, string> = {
  [DashboardApi.LoadDashboard]: '/dashboards/:id',
  [DashboardApi.SaveDashboard]: '/dashboards',
  [DashboardApi.DeleteDashboard]: '/dashboards/:id',
  [DashboardApi.AllDashboards]: '/dashboards',
  [DashboardApi.DefaultDashboard]: '/dashboards/default',
  [DashboardApi.ExecuteQuery]: '/query/execute',
  [DashboardApi.ExecuteQueries]: '/queries/execute',
  [DashboardApi.GetDatasource]: '/datasources/:id',
  [DashboardApi.DefaultDatasource]: '/datasources/default',
};

export interface DashboardSdkOptions {
  /** 指定加载的 dashboard id，默认加载 default */
  dashboardId?: string;
  /** 可选 pinia 实例，默认取当前 active pinia 或自动创建 */
  pinia?: Pinia;
  /** 是否自动加载 dashboard 数据，默认为 true */
  autoLoad?: boolean;
  /** 自定义数据源根路径（dsn）以及接口路径配置 */
  apiConfig?: DashboardSdkApiConfig;
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
  dsn?: string;
  endpoints?: Partial<Record<DashboardApi, string>>;
}

export interface ResolvedDashboardSdkApiConfig {
  dsn: string;
  endpoints: Record<DashboardApi, string>;
}

export interface DashboardSdkActions {
  loadDashboard: (id: ID) => Promise<unknown>;
  saveDashboard: () => Promise<unknown>;
  toggleEditMode: () => void;
  addPanelGroup: (group: Partial<PanelGroup>) => unknown;
  updatePanelGroup: (id: ID, updates: Partial<PanelGroup>) => unknown;
  deletePanelGroup: (id: ID) => unknown;
  updatePanelGroupLayout: (groupId: ID, layout: PanelLayout[]) => unknown;
  duplicatePanel: (groupId: ID, panelId: ID) => unknown;
  togglePanelView: (groupId: ID, panelId: ID) => unknown;
  getPanelGroupById: (id: ID) => unknown;
  getPanelById: (groupId: ID, panelId: ID) => unknown;
  setTimeRange: (range: TimeRange) => unknown;
  setRefreshInterval: (interval: number) => unknown;
  refreshTimeRange: () => unknown;
  registerChart: (...args: any[]) => unknown;
  updateChartRegistration: (...args: any[]) => unknown;
  unregisterChart: (...args: any[]) => unknown;
  setGlobalMousePosition: (pos: MousePosition) => unknown;
  /** 设置主题偏好并应用（light/dark/system） */
  setTheme: (theme: DashboardTheme) => DashboardTheme;
  setThemePreference: (preference: DashboardThemePreference) => DashboardTheme;
  toggleTheme: () => DashboardTheme;
  getTheme: () => DashboardTheme;
}

export interface UseDashboardSdkResult {
  pinia: Pinia;
  ready: Ref<boolean>;
  targetRef: Ref<HTMLElement | null>;
  containerSize: Ref<{ width: number; height: number }>;
  state: ComputedRef<DashboardSdkState>;
  api: ComputedRef<ResolvedDashboardSdkApiConfig>;
  actions: DashboardSdkActions;
  theme: Ref<DashboardTheme>;
  themePreference: Ref<DashboardThemePreference>;
  mountDashboard: () => void;
  unmountDashboard: () => void;
  /**
   * For advanced/debug usage only. Typed as `unknown` to avoid exposing internal store state types.
   * Prefer `state` + `actions` for a stable public surface.
   */
  dashboardStore: unknown;
  timeRangeStore: unknown;
  tooltipStore: unknown;
}

function ensurePinia(pinia?: Pinia) {
  if (pinia) {
    // 外部传入实例时，直接设为当前激活实例
    setActivePinia(pinia);
    return pinia;
  }

  const active = getActivePinia();
  if (active) return active;

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
  const pinia = ensurePinia(options.pinia);
  const dashboardStore = useDashboardStore(pinia);
  const timeRangeStore = useTimeRangeStore(pinia);
  const tooltipStore = useTooltipStore(pinia);

  const containerSize = ref({ width: 0, height: 0 });
  const ready = ref(false);
  const dashboardApp = ref<App<Element> | null>(null);
  const themePreference = ref<DashboardThemePreference>('system');
  const theme = ref<DashboardTheme>('light');

  const DashboardSdkRoot = defineComponent({
    name: 'DashboardSdkRoot',
    setup() {
      return () => h(DashboardView, { theme: theme.value });
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

  const handleMouseMove = (event: MouseEvent) => {
    tooltipStore.updateGlobalMousePosition({
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  };

  // 将 dsn 与自定义 endpoints 合并为完整 URL，暴露给外部调试/使用
  const resolvedApiConfig = computed<ResolvedDashboardSdkApiConfig>(() => {
    const dsn = (options.apiConfig?.dsn ?? DEFAULT_DSN).replace(/\/$/, '');
    const overrides = options.apiConfig?.endpoints ?? {};
    const endpoints: Record<DashboardApi, string> = { ...DEFAULT_DASHBOARD_ENDPOINTS, ...overrides };
    const resolved: Record<DashboardApi, string> = Object.fromEntries(
      Object.entries(endpoints).map(([key, value]) => {
        const normalized = value.startsWith('http') ? value : `${dsn}${value.startsWith('/') ? value : `/${value}`}`;
        return [key as DashboardApi, normalized];
      })
    ) as Record<DashboardApi, string>;
    return { dsn, endpoints: resolved };
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
      // 容器变化时重绑事件和 ResizeObserver
      prevEl?.removeEventListener('mousemove', handleMouseMove);
      if (resizeObserver && prevEl) {
        resizeObserver.unobserve(prevEl);
      }

      if (el) {
        el.addEventListener('mousemove', handleMouseMove, { passive: true });
        resizeObserver?.observe(el);
        updateSize();

        if (dashboardApp.value && prevEl !== el) {
          unmountDashboard();
          mountDashboard();
        }
      }

      onCleanup(() => {
        el?.removeEventListener('mousemove', handleMouseMove);
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
      // Initialize theme as early as possible so tokens are ready before first paint.
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
    const el = targetRef.value;
    el?.removeEventListener('mousemove', handleMouseMove);
    resizeObserver?.disconnect();
    resizeObserver = null;
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
