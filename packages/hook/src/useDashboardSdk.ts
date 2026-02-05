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
import { computed, createApp, defineComponent, h, onMounted, onUnmounted, ref, toRaw, watch, type App, type Ref } from 'vue';
import { createPinia } from '@grafana-fast/store';
import type { ID, TimeRange } from '@grafana-fast/types';
import {
  DashboardView,
  disposePiniaQueryScheduler,
  getStoredThemePreference,
  setDashboardThemePreference,
  setPiniaApiClient,
  useDashboardStore,
  useTimeRangeStore,
  useVariablesStore,
  type DashboardTheme,
  type DashboardThemePreference,
} from '@grafana-fast/dashboard';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import { createPrefixedId, deepCloneStructured } from '@grafana-fast/utils';

import { createEmitter } from './emitter';
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
  const pinia = createPinia();
  // 重要：标记该 pinia 为 “SDK 挂载专用”。
  // DashboardView（对外导出的组件）会在未检测到该标记时拒绝加载（防止直接用组件方式集成）。
  (pinia as any).__gfDashboardSdkMount = true;

  const emitError = (error: unknown) => {
    emitter.emit('error', { error });
    options.onError?.(error);
  };

  // ---------------------------
  // API client（remote/mock 切换）
  // ---------------------------
  const remoteApiClient = options.apiClient;
  const isMockEnabled = options.enableMock === true && typeof options.createMockApiClient === 'function';
  const apiSwitching = ref(false);
  const apiMode = ref<'remote' | 'mock'>(
    (() => {
      const preferred = options.defaultApiMode;
      if (preferred === 'mock') return isMockEnabled ? 'mock' : remoteApiClient ? 'remote' : 'remote';
      if (preferred === 'remote') return remoteApiClient ? 'remote' : isMockEnabled ? 'mock' : 'remote';
      // Default strategy: remote first, then mock.
      return remoteApiClient ? 'remote' : isMockEnabled ? 'mock' : 'remote';
    })()
  );

  let mockApiClientCache: GrafanaFastApiClient | null = null;
  const activeApiClient = ref<GrafanaFastApiClient | undefined>(remoteApiClient);

  const resolveApiClientForMode = async (mode: 'remote' | 'mock'): Promise<GrafanaFastApiClient> => {
    if (mode === 'remote') {
      if (!remoteApiClient) {
        throw new Error('[grafana-fast] Remote mode requires `apiClient`.');
      }
      return remoteApiClient;
    }
    if (!isMockEnabled || !options.createMockApiClient) {
      throw new Error('[grafana-fast] Mock mode is disabled. Set `enableMock=true` and provide `createMockApiClient()`.');
    }
    if (mockApiClientCache) return mockApiClientCache;
    mockApiClientCache = await options.createMockApiClient();
    return mockApiClientCache;
  };

  const applyApiMode = async (mode: 'remote' | 'mock', opts: { remount?: boolean } = {}) => {
    const client = await resolveApiClientForMode(mode);
    activeApiClient.value = client;
    apiMode.value = mode;
    // Attach runtime deps to pinia so dashboard stores/scheduler can access it.
    setPiniaApiClient(pinia, client);

    if (opts.remount !== false) {
      try {
        disposePiniaQueryScheduler(pinia);
      } catch {
        // ignore
      }
      if (isDashboardMounted.value) {
        unmountDashboard();
        mountDashboard();
      }
    }
    scheduleChange();
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
  const dashboardViewRef = ref<any>(null);
  const isDashboardMounted = ref(false);

  // 在首次渲染前应用 readOnly（仅写入 store；不走 props-driven 同步）。
  dashboardStore.setReadOnly(options.readOnly === true);

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

  const apiModeOptions = computed(() => {
    if (options.enableMock !== true) return undefined;
    return [
      { label: '远程', value: 'remote', disabled: !remoteApiClient },
      { label: '本地 Mock', value: 'mock', disabled: !isMockEnabled },
    ] as Array<{ label: string; value: 'remote' | 'mock'; disabled?: boolean }>;
  });

  const requestApiModeChange = async (mode: 'remote' | 'mock') => {
    if (mode === apiMode.value) return;
    if (apiSwitching.value) return;
    apiSwitching.value = true;
    try {
      await applyApiMode(mode);
    } catch (error) {
      emitError(error);
      throw error;
    } finally {
      apiSwitching.value = false;
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

      // Ensure the initial apiClient is attached to pinia before mounting/auto-load.
      if (remoteApiClient || isMockEnabled) {
        apiSwitching.value = true;
        try {
          await applyApiMode(apiMode.value, { remount: false });
        } catch (error) {
          emitError(error);
        } finally {
          apiSwitching.value = false;
        }
      }

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
    // 时间范围
    setTimeRange: (range: TimeRange) => timeRangeStore.setTimeRange(deepCloneStructured(range)),
    setRefreshInterval: (interval: number) => timeRangeStore.setRefreshInterval(interval),
    refreshTimeRange: () => timeRangeStore.refresh(),

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
  };

  return {
    on: emitter.on,
    off: emitter.off,
    getState,
    actions,
  };
}
