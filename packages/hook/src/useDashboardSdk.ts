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
import type { DashboardContent, ID, Panel, PanelGroup, PanelLayout, TimeRange, VariablesState } from '@grafana-fast/types';
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
} from '@grafana-fast/dashboard';
import { createHttpApiClient, createMockApiClient, type GrafanaFastApiClient } from '@grafana-fast/api';
import { createPrefixedId, deepCloneStructured } from '@grafana-fast/utils';

import { createEmitter } from './emitter';
import { resolveDashboardSdkApiConfig } from './sdk/apiConfig';
import { computeDashboardSdkChangedKeys } from './sdk/state';
import type {
  DashboardSdkActions,
  DashboardSdkBootStage,
  DashboardSdkDashboardSummary,
  DashboardSdkEventMap,
  DashboardSdkOptions,
  DashboardSdkStateSnapshot,
  DashboardSdkViewMode,
  UseDashboardSdkResult,
} from './sdk/types';

export { DashboardApi, DEFAULT_DASHBOARD_ENDPOINTS } from './sdk/api';
export type {
  DashboardSdkActions,
  DashboardSdkApiConfig,
  DashboardSdkBootStage,
  DashboardSdkChangePayload,
  DashboardSdkDashboardSummary,
  DashboardSdkEventMap,
  DashboardSdkEventName,
  DashboardSdkOptions,
  DashboardSdkStateSnapshot,
  DashboardSdkViewMode,
  ResolvedDashboardSdkApiConfig,
  UseDashboardSdkResult,
} from './sdk/types';

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

  const resolvedApiConfig = resolveDashboardSdkApiConfig(options.apiConfig);

  const getDashboardSummary = (): DashboardSdkDashboardSummary | null => {
    const dash = dashboardStore.currentDashboard;
    if (!dash) return null;
    const groups = dash.panelGroups ?? [];
    let panelCount = 0;
    for (const g of groups) panelCount += g.panels?.length ?? 0;
    return {
      id: (dashboardStore as any).dashboardId ?? null,
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

  const getDashboardSnapshot = (): DashboardContent | null => {
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

  const emitChange = () => {
    const next = getState();
    const prev = lastEmittedState;
    const changedKeys = computeDashboardSdkChangedKeys(prev, next);
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
    setDashboard: (dashboard: DashboardContent, opts?: { markAsSynced?: boolean }) => {
      const next = deepCloneStructured(dashboard);

      // 优先使用 store 提供的 replaceDashboard：把一致性约束收敛在 store 层（更可靠）。
      const replace = (dashboardStore as any).replaceDashboard as undefined | ((d: DashboardContent, o?: any) => void);
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
