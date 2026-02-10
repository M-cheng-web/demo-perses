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
import type { ID, TimeRange } from '@grafana-fast/types';
import {
  DashboardView,
  disposePiniaQueryScheduler,
  getStoredThemePreference,
  setPiniaApiClient,
  setDashboardThemePreference,
  useDashboardStore,
  useTimeRangeStore,
  useVariablesStore,
  type DashboardTheme,
  type DashboardThemePreference,
} from '@grafana-fast/dashboard';
import { createPrefixedId, deepCloneStructured } from '@grafana-fast/utils';

import { createEmitter } from './emitter';
import { computeDashboardSdkChangedKeys } from './sdk/state';
import { useDashboardApiMode } from './sdk/useDashboardApiMode';
import { useDashboardMountLifecycle } from './sdk/useDashboardMountLifecycle';
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

type DashboardViewExpose = {
  openSettings?: () => void;
  closeSettings?: () => void;
  toggleSettings?: () => void;
  toolbar?: {
    openJsonModal?: (mode?: 'view' | 'edit') => void;
    closeJsonModal?: () => void;
    refresh?: () => void;
    save?: () => Promise<void>;
    togglePanelsView?: () => void;
    addPanelGroup?: () => void;
    exportJson?: () => void;
    importJson?: () => void;
    viewJson?: () => void;
    applyJson?: () => Promise<void>;
    setTimeRangePreset?: (preset: string) => void;
  };
};

export { DashboardApi, DEFAULT_DASHBOARD_ENDPOINTS } from './sdk/api';
export type {
  DashboardSdkActions,
  DashboardSdkBootStage,
  DashboardSdkChangePayload,
  DashboardSdkDashboardSummary,
  DashboardSdkEventMap,
  DashboardSdkEventName,
  DashboardSdkOptions,
  DashboardSdkStateSnapshot,
  DashboardSdkViewMode,
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
  const pinia: ReturnType<typeof createPinia> & { __gfDashboardSdkMount?: true } = createPinia();
  // 重要：标记该 pinia 为 “SDK 挂载专用”。
  // DashboardView（对外导出的组件）会在未检测到该标记时拒绝加载（防止直接用组件方式集成）。
  pinia.__gfDashboardSdkMount = true;

  const emitError = (error: unknown) => {
    emitter.emit('error', { error });
    options.onError?.(error);
  };

  const dashboardStore = useDashboardStore(pinia);
  const timeRangeStore = useTimeRangeStore(pinia);
  const variablesStore = useVariablesStore(pinia);

  const containerSize = ref({ width: 0, height: 0 });
  const ready = ref(false);
  const dashboardApp = ref<App<Element> | null>(null);
  const themePreference = ref<DashboardThemePreference>('system');
  const theme = ref<DashboardTheme>('light');
  const themePersist = options.persistThemePreference === true;
  const themeApplyToDocument = options.applyThemeToDocument === true;
  const instanceId = options.instanceId ?? `sdk-${createPrefixedId('dash')}`;
  const dashboardViewRef = ref<DashboardViewExpose | null>(null);
  const isDashboardMounted = ref(false);

  // apiReady: 保存 initializeApiClient 的 promise，供 actions 在调用 store 前 await，
  // 避免宿主在 onMounted 中调用 loadDashboard 时 apiClient 尚未就绪的竞态。
  let apiReadyResolve: (() => void) | null = null;
  const apiReadyPromise = new Promise<void>((resolve) => {
    apiReadyResolve = resolve;
  });

  // 在首次渲染前应用 readOnly（仅写入 store；不走 props-driven 同步）。
  dashboardStore.setReadOnly(options.readOnly === true);

  const getDashboardSummary = (): DashboardSdkDashboardSummary | null => {
    const dash = dashboardStore.currentDashboard;
    if (!dash) return null;
    const groups = dash.panelGroups ?? [];
    let panelCount = 0;
    for (const g of groups) panelCount += g.panels?.length ?? 0;
    return {
      id: dashboardStore.dashboardId ?? null,
      name: dash.name,
      groupCount: groups.length,
      panelCount,
    };
  };

  const getDashboardRevision = (): number => {
    const raw = Number(dashboardStore.dashboardContentRevision ?? 0);
    return Number.isFinite(raw) ? Math.floor(raw) : 0;
  };

  const getState = (): DashboardSdkStateSnapshot => {
    const timeRange = deepCloneStructured(toRaw(timeRangeStore.timeRange));
    const rawViewPanelId = (dashboardStore.viewPanelId ?? null) as { groupId: ID; panelId: ID } | null;
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

  const applyContainerSize = (next: { width: number; height: number }) => {
    if (next.width === containerSize.value.width && next.height === containerSize.value.height) return;
    containerSize.value = next;
    scheduleChange();
  };

  function mountDashboard() {
    if (dashboardApp.value || !targetRef.value || isDashboardMounted.value) return;
    const app = createApp(DashboardSdkRoot);
    app.use(pinia);
    app.mount(targetRef.value);
    dashboardApp.value = app;
    isDashboardMounted.value = true;
    scheduleChange();
  }

  function unmountDashboard() {
    if (dashboardApp.value && isDashboardMounted.value) {
      dashboardApp.value.unmount();
      dashboardApp.value = null;
      isDashboardMounted.value = false;
      scheduleChange();
    }
  }

  const {
    activeApiClient,
    apiMode,
    apiModeOptions,
    apiSwitching,
    hasApiSource,
    applyApiMode,
    requestApiModeChange: requestApiModeChangeInternal,
  } = useDashboardApiMode({
    sdkOptions: options,
    pinia,
    runtimeBindings: {
      attachApiClient: setPiniaApiClient,
      disposeQueryScheduler: disposePiniaQueryScheduler,
    },
    isDashboardMounted,
    mountDashboard,
    unmountDashboard,
    onApplied: scheduleChange,
  });

  const requestApiModeChange = async (mode: 'remote' | 'mock') => {
    try {
      await requestApiModeChangeInternal(mode);
    } catch (error) {
      emitError(error);
      throw error;
    }
  };

  const DashboardSdkRoot = defineComponent({
    name: 'DashboardSdkRoot',
    setup() {
      return () =>
        h(DashboardView, {
          ref: dashboardViewRef,
          theme: theme.value,
          portalTarget: options.portalTarget ?? null,
          apiClient: activeApiClient.value,
          instanceId,
          apiMode: apiMode.value,
          apiModeOptions: apiModeOptions.value,
          apiModeSwitching: apiSwitching.value,
          onRequestApiModeChange: requestApiModeChange,
        });
    },
  });

  useDashboardMountLifecycle({
    targetRef,
    isMountedRef: isDashboardMounted,
    mountDashboard,
    unmountDashboard,
    onSizeChange: applyContainerSize,
  });

  const runAsyncWithError = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      emitError(error);
      throw error;
    }
  };

  const runWithError = (operation: () => void): void => {
    try {
      operation();
    } catch (error) {
      emitError(error);
    }
  };

  const applyTheme = (preference: DashboardThemePreference, opts: { emitChange?: boolean } = {}): DashboardTheme => {
    themePreference.value = preference;
    theme.value = setDashboardThemePreference(preference, { persist: themePersist, apply: themeApplyToDocument });
    if (opts.emitChange !== false) {
      scheduleChange();
    }
    return theme.value;
  };

  const initializeApiClient = async () => {
    if (!hasApiSource) return;
    apiSwitching.value = true;
    try {
      await applyApiMode(apiMode.value, { remount: false });
    } catch (error) {
      emitError(error);
    } finally {
      apiSwitching.value = false;
    }
  };

  onMounted(async () => {
    try {
      // 尽可能早初始化主题：保证第一次渲染前 token/变量已就绪
      const storedPreference = themePersist ? getStoredThemePreference() : null;
      const initialPreference = options.themePreference ?? storedPreference ?? 'system';
      // 默认不修改宿主 document；如需全站主题接管，可通过 applyThemeToDocument 开启
      applyTheme(initialPreference, { emitChange: false });

      // Ensure the initial apiClient is attached to pinia before mounting/auto-load.
      await initializeApiClient();
      apiReadyResolve?.();

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
    // 卸载时要停止后台刷新，避免内存泄漏或多实例互相影响
    try {
      timeRangeStore.stopAutoRefresh();
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
      () => dashboardStore.editingGroupId,
      () => dashboardStore.viewPanelId,
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
    // Dashboard 数据加载/保存
    loadDashboard: async (id: ID) =>
      runAsyncWithError(async () => {
        await apiReadyPromise;
        await dashboardStore.loadDashboard(id);
        scheduleChange();
      }),
    saveDashboard: async () =>
      runAsyncWithError(async () => {
        await apiReadyPromise;
        await dashboardStore.saveDashboard();
        scheduleChange();
      }),
    // 时间范围
    setTimeRange: (range: TimeRange) => timeRangeStore.setTimeRange(deepCloneStructured(range)),
    setRefreshInterval: (interval: number) => timeRangeStore.setRefreshInterval(interval),
    refreshTimeRange: () => timeRangeStore.refresh(),

    getTheme: () => theme.value,
    setTheme: (next: DashboardTheme) => applyTheme(next),
    setThemePreference: (preference: DashboardThemePreference) => applyTheme(preference),
    toggleTheme: () => applyTheme(theme.value === 'dark' ? 'light' : 'dark'),

    setReadOnly: (ro: boolean) => {
      dashboardStore.setReadOnly(!!ro);
      scheduleChange();
    },

    setVariableValue: (name: string, value: string | string[]) =>
      runWithError(() => {
        variablesStore.setValue(name, value);
        scheduleChange();
      }),
    setVariableValues: (values: Record<string, string | string[]>) =>
      runWithError(() => {
        variablesStore.setValues(values);
        scheduleChange();
      }),
    refreshVariableOptions: () =>
      runWithError(() => {
        void variablesStore.resolveOptions();
      }),
  };

  return {
    on: emitter.on,
    off: emitter.off,
    getState,
    actions,
  };
}
