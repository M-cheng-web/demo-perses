/**
 * QueryScheduler（调度层）
 *
 * 目标：
 * - 把“查询触发”从各处 watch 里收敛到一个中心调度器
 * - 统一处理：timeRange 变化、变量变化、面板 query 变化、虚拟滚动可视状态变化
 * - 统一输出面板生命周期 phase，供 UI 一处渲染 loading（避免多段 loading 接力）
 */
import { watch } from 'vue';
import { storeToRefs, type Pinia } from '@grafana-fast/store';
import { useTimeRangeStore, useVariablesStore } from '/#/stores';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { QueryRunner } from '../queryRunner';
import type {
  PanelRegistration,
  PanelQueryPhase,
  PanelLoadingKind,
  QuerySchedulerDebugSnapshot,
  RefreshReason,
  RefreshTask,
  ViewportStatePayload,
} from './types';
import { derivePassivePhase, LOADING_PHASES, resolveLoadingKindForRequest } from './viewState';
import { pickNextTask } from './queue';
import { computeViewportDiff, recomputeUnion } from './reconcile';
import { runPanelRequest } from './panelRunner';
import { createPanelRegistrationApi } from './panelRegistration';

/**
 * 创建一个 QueryScheduler 实例
 *
 * @param pinia 可选：绑定到指定 pinia 实例（推荐用于多 dashboard 同页挂载）
 */
export function createQueryScheduler(pinia?: Pinia) {
  const api = getPiniaApiClient(pinia);
  const runner = new QueryRunner(api, { maxConcurrency: 6, cacheTtlMs: 5_000 });
  const MIN_LOADING_MS = 200;
  const REGISTRATION_TTL_MS = 5 * 60 * 1000;

  const timeRangeStore = useTimeRangeStore(pinia);
  const { absoluteTimeRange } = storeToRefs(timeRangeStore);
  const variablesStore = useVariablesStore(pinia);
  const { valuesGeneration } = storeToRefs(variablesStore);

  // bookkeeping（不进入 Vue reactive）
  const registrations = new Map<string, PanelRegistration>();

  /**
   * 可视状态分为两层：
   * - renderPanelIds: 需要挂载 DOM（可显示 waiting/loading）
   * - activePanelIds: 允许发请求（通常是 idle 后 hot 窗口）
   */
  const renderByScope = new Map<string, Set<string>>();
  const activeByScope = new Map<string, Set<string>>();
  const renderPanels = new Set<string>();
  const activePanels = new Set<string>();

  // 刷新队列（panel 级别）
  const maxPanelConcurrency = 4;
  let panelInflight = 0;
  let queueGeneration = 0;
  let conditionGeneration = 0;
  const pending = new Map<string, RefreshTask>();

  const isPanelRendered = (panelId: string) => renderPanels.has(panelId);
  const isPanelActive = (panelId: string) => activePanels.has(panelId);

  const isRegStale = (reg: PanelRegistration) => reg.dirty || (reg.hasSnapshot && reg.lastLoadedConditionGen !== conditionGeneration);

  const touchRegistration = (reg: PanelRegistration) => {
    reg.lastDetachedAt = 0;
  };

  const markRegistrationDetached = (reg: PanelRegistration) => {
    reg.lastDetachedAt = Date.now();
  };

  const syncPanelDerivedState = (reg: PanelRegistration) => {
    reg.state.loadingKind.value = reg.loadingKind;
    reg.state.hasSnapshot.value = reg.hasSnapshot;
    reg.state.stale.value = reg.hasSnapshot && isRegStale(reg);
  };

  const setLoadingKind = (reg: PanelRegistration, kind: PanelLoadingKind) => {
    reg.loadingKind = kind;
    reg.state.loadingKind.value = kind;
  };

  const markPanelDirty = (reg: PanelRegistration, dirty: boolean) => {
    reg.dirty = dirty;
    syncPanelDerivedState(reg);
  };

  const deriveRegPassivePhase = (reg: PanelRegistration): PanelQueryPhase =>
    derivePassivePhase({
      rendered: isPanelRendered(reg.panelId),
      mounted: reg.mounts > 0,
      hasSnapshot: reg.hasSnapshot,
      hasError: Boolean(reg.state.error.value),
      pending: pending.has(reg.panelId),
      inflight: reg.inflight,
    });

  const setPanelPhase = (reg: PanelRegistration, phase: PanelQueryPhase) => {
    if (!LOADING_PHASES.has(phase)) {
      setLoadingKind(reg, 'none');
    }
    syncPanelDerivedState(reg);
    reg.state.phase.value = phase;
  };

  const cleanupDetachedRegistrations = () => {
    if (registrations.size === 0) return;
    const now = Date.now();
    for (const [id, reg] of registrations) {
      if (reg.mounts > 0) continue;
      if (reg.inflight) continue;
      if (pending.has(id)) continue;
      if (isPanelRendered(id) || isPanelActive(id)) continue;
      if (reg.lastDetachedAt <= 0) continue;
      if (now - reg.lastDetachedAt < REGISTRATION_TTL_MS) continue;
      reg.stopQueryWatch?.();
      reg.stopQueryWatch = undefined;
      registrations.delete(id);
    }
  };

  const bumpQueueGeneration = () => {
    queueGeneration++;

    // Pending tasks are canceled; recompute phase for those panels.
    for (const id of pending.keys()) {
      const reg = registrations.get(id);
      if (reg && !reg.inflight) setPanelPhase(reg, deriveRegPassivePhase(reg));
    }
    pending.clear();

    // Abort all in-flight panels so old requests don't waste network.
    for (const reg of registrations.values()) {
      reg.abort?.abort();
    }

    cleanupDetachedRegistrations();
  };

  const bumpConditionGeneration = () => {
    conditionGeneration++;
    for (const reg of registrations.values()) {
      syncPanelDerivedState(reg);
    }
    bumpQueueGeneration();
  };

  const runPanel = (reg: PanelRegistration) =>
    runPanelRequest(reg, {
      runner,
      absoluteTimeRange: absoluteTimeRange.value,
      variablesValues: (variablesStore.state?.values ?? {}) as Record<string, string | string[]>,
      getConditionGeneration: () => conditionGeneration,
      minLoadingMs: MIN_LOADING_MS,
      pending,
      setLoadingKind,
      setPanelPhase,
      markPanelDirty,
      isPanelRendered,
      isPanelActive,
      deriveRegPassivePhase,
    });

  const drain = () => {
    while (panelInflight < maxPanelConcurrency && pending.size > 0) {
      const next = pickNextTask(pending);
      if (!next) break;
      pending.delete(next.panelId);
      panelInflight++;

      void (async () => {
        const reg = registrations.get(next.panelId);
        if (!reg) return;
        if (!isPanelActive(next.panelId) || next.generation !== queueGeneration) {
          if (!reg.inflight) setPanelPhase(reg, deriveRegPassivePhase(reg));
          return;
        }
        await runPanel(reg);
      })().finally(() => {
        panelInflight--;
        drain();
      });
    }
  };

  const enqueue = (panelId: string, reason: RefreshReason, priority: number) => {
    const reg = registrations.get(panelId);
    if (!reg) return;

    if (reason === 'manual' || reason === 'panel-change') {
      markPanelDirty(reg, true);
    }

    if (!isPanelActive(panelId)) {
      if (!reg.inflight) setPanelPhase(reg, deriveRegPassivePhase(reg));
      return;
    }

    const now = Date.now();
    // Simple per-panel debounce: don't enqueue too frequently.
    if (now - reg.lastEnqueuedAt < 300 && reason === 'became-visible') {
      const shouldBypass = !reg.hasSnapshot || isRegStale(reg);
      if (!shouldBypass) return;
    }
    reg.lastEnqueuedAt = now;

    reg.loadingToken = reg.loadingToken + 1;

    if (reg.loadingKind === 'none') {
      setLoadingKind(reg, resolveLoadingKindForRequest(reg.hasSnapshot));
    }

    const existing = pending.get(panelId);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      existing.generation = queueGeneration;
      existing.reason = reason;
      if (!reg.inflight) setPanelPhase(reg, 'queued');
      return;
    }

    pending.set(panelId, { panelId, priority, generation: queueGeneration, reason, enqueuedAt: now });
    if (!reg.inflight) setPanelPhase(reg, 'queued');
    drain();
  };

  const enqueueActive = (reason: RefreshReason, priority: number) => {
    for (const id of activePanels) {
      enqueue(id, reason, priority);
    }
  };

  // 时间范围变化 -> 刷新 active 面板
  watch(absoluteTimeRange, () => {
    bumpConditionGeneration();
    enqueueActive('timeRange', 30);
  });

  // 变量值变化 -> 刷新 active 面板（优先级略低于 timeRange）
  watch(valuesGeneration, () => {
    bumpConditionGeneration();
    enqueueActive('variables', 28);
  });

  const { registerPanel, unregisterPanel } = createPanelRegistrationApi({
    registrations,
    pending,
    isPanelRendered,
    isPanelActive,
    isRegStale,
    touchRegistration,
    markRegistrationDetached,
    cleanupDetachedRegistrations,
    setPanelPhase,
    deriveRegPassivePhase,
    enqueue,
  });

  const setViewportState = (scopeId: string, payload: ViewportStatePayload) => {
    const prevRender = new Set(renderPanels);
    const prevActive = new Set(activePanels);

    renderByScope.set(scopeId, new Set(payload.renderPanelIds));
    activeByScope.set(scopeId, new Set(payload.activePanelIds));

    const nextRender = recomputeUnion(renderByScope);
    const nextActive = recomputeUnion(activeByScope);

    const { addedRender, removedRender, addedActive, removedActive } = computeViewportDiff(prevRender, prevActive, nextRender, nextActive);

    renderPanels.clear();
    for (const id of nextRender) renderPanels.add(id);

    activePanels.clear();
    for (const id of nextActive) activePanels.add(id);

    const reconcilePanelById = (id: string) => {
      const reg = registrations.get(id);
      if (!reg) return;

      if (isPanelRendered(id) || isPanelActive(id)) {
        touchRegistration(reg);
      }

      if (!isPanelRendered(id)) {
        if (!reg.inflight) setPanelPhase(reg, 'idle');
        return;
      }

      if (!isPanelActive(id)) {
        if (!reg.inflight && !pending.has(id)) setPanelPhase(reg, deriveRegPassivePhase(reg));
        return;
      }

      if (pending.has(id)) {
        if (!reg.inflight) setPanelPhase(reg, 'queued');
        return;
      }

      if (reg.inflight) {
        setPanelPhase(reg, 'loading');
        return;
      }

      if (!reg.hasSnapshot || isRegStale(reg)) {
        enqueue(id, 'became-visible', 25);
        return;
      }

      setPanelPhase(reg, reg.state.error.value ? 'error' : 'ready');
    };

    // Active-only policy: drop pending tasks for panels that are no longer active.
    for (const id of removedActive) {
      if (!pending.has(id)) continue;
      pending.delete(id);
      const reg = registrations.get(id);
      if (reg && !reg.inflight) setPanelPhase(reg, deriveRegPassivePhase(reg));
    }

    // Panels no longer rendered and already unmounted -> abort in-flight.
    for (const id of removedRender) {
      const reg = registrations.get(id);
      if (!reg || !reg.inflight) continue;
      if (reg.mounts > 0) continue;
      reg.abort?.abort();
    }

    const impacted = new Set<string>([...addedRender, ...removedRender, ...addedActive, ...removedActive]);
    for (const id of impacted) {
      reconcilePanelById(id);
    }

    cleanupDetachedRegistrations();
  };

  const getDebugSnapshot = (): QuerySchedulerDebugSnapshot => ({
    queueGeneration,
    conditionGeneration,
    registrationCount: registrations.size,
    renderPanelCount: renderPanels.size,
    activePanelCount: activePanels.size,
    pendingCount: pending.size,
    inflightCount: panelInflight,
    renderPanelIds: [...renderPanels],
    activePanelIds: [...activePanels],
    pendingTasks: [...pending.values()]
      .sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt)
      .map((task) => ({
        panelId: task.panelId,
        reason: task.reason,
        priority: task.priority,
        generation: task.generation,
        enqueuedAt: task.enqueuedAt,
      })),
  });

  return {
    /** 注册面板（按 panelId 唯一） */
    registerPanel,
    /** 反注册面板（组件卸载时调用） */
    unregisterPanel,
    /** 手动刷新全部面板（例如“刷新按钮”） */
    refreshAll: () => {
      for (const reg of registrations.values()) {
        markPanelDirty(reg, true);
        enqueue(reg.panelId, 'manual', 10);
      }
    },
    /** 刷新当前 active 区域 */
    refreshVisible: () => {
      bumpQueueGeneration();
      enqueueActive('manual', 30);
    },
    /** 清空 QueryRunner 缓存（下次执行会重新拉取） */
    invalidateAll: () => runner.invalidateAll(),
    /** 上报某个 scope 的渲染/激活集合 */
    setViewportState,
    /** 查询调度器调试快照 */
    getDebugSnapshot,
  };
}
