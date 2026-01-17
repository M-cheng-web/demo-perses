/**
 * QueryScheduler（调度层）
 *
 * 目标：
 * - 把“查询触发”从各处 watch 里收敛到一个中心调度器
 * - 统一处理：timeRange 变化、变量变化、面板 query 变化 -> 触发刷新
 * - 支持依赖分析：变量变化时只刷新依赖该变量的 panel（避免全量刷新）
 *
 * 结构：
 * - registerPanel(panelId, panelRef) 注册一个面板（返回该面板的 loading/error/results/refreh）
 * - 内部使用 QueryRunner 执行（并发/缓存/取消）
 *
 * 注意：
 * - 这个调度器应是“按 dashboard 实例隔离”的（通常绑定到 pinia 实例）
 */
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { CanonicalQuery, Panel, QueryContext, QueryResult } from '@grafana-fast/types';
import { storeToRefs, type Pinia } from '@grafana-fast/store';
import { useTimeRangeStore, useVariablesStore } from '/#/stores';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { extractVariableRefs } from './interpolate';
import { QueryRunner } from './queryRunner';

export interface PanelQueryState {
  /** 当前是否加载中 */
  loading: Ref<boolean>;
  /** 当前错误信息（空字符串表示无错误） */
  error: Ref<string>;
  /** 当前查询结果（多 query 对齐） */
  results: Ref<QueryResult[]>;
  /** 主动触发刷新 */
  refresh: () => void;
}

interface PanelRegistration {
  panelId: string;
  getPanel: () => Panel;
  deps: Set<string>;
  state: PanelQueryState;
  abort: AbortController | null;
  lastEnqueuedAt: number;
  /** 当前是否有实际请求在执行（in-flight） */
  inflight: boolean;
  /** 用于防止 setTimeout 清理 loading 的竞态（每次请求 +1） */
  loadingToken: number;
  /** 当前有多少个组件实例“挂载”了这个 panel（虚拟化场景下会频繁 mount/unmount） */
  mounts: number;
  /** 停止对当前 panelRef 的 queries watch（每次 mount 更新 ref 时需替换） */
  stopQueryWatch?: () => void;
  /**
   * 这个 panel 最近一次“成功落地结果”的全局条件代际。
   * - 条件代际只在 timeRange/variables 变化时递增
   * - 用于保证：滚动导致的 mount/unmount 不会触发重复刷新
   */
  lastLoadedConditionGen: number;
}

type RefreshReason = 'timeRange' | 'variables' | 'panel-change' | 'became-visible' | 'manual';

interface RefreshTask {
  panelId: string;
  priority: number;
  generation: number;
  reason: RefreshReason;
  enqueuedAt: number;
}

export interface QuerySchedulerDebugTask {
  panelId: string;
  priority: number;
  reason: RefreshReason;
  ageMs: number;
}

export interface QuerySchedulerDebugSnapshot {
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
  topPending: QuerySchedulerDebugTask[];
}

/**
 * 创建一个 QueryScheduler 实例
 *
 * @param pinia 可选：绑定到指定 pinia 实例（推荐用于多 dashboard 同页挂载）
 *
 * 行为：
 * - 追踪已注册 panel
 * - timeRange 变化 -> 全量刷新
 * - variable 变化 -> 只刷新依赖该变量的 panel
 * - 面板 queries 变化 -> 更新依赖关系并刷新该 panel
 */
export function createQueryScheduler(pinia?: Pinia) {
  const api = getPiniaApiClient(pinia);
  const runner = new QueryRunner(api, { maxConcurrency: 6, cacheTtlMs: 5_000 });
  const MIN_LOADING_MS = 200;

  const timeRangeStore = useTimeRangeStore(pinia);
  const variablesStore = useVariablesStore(pinia);
  const { absoluteTimeRange } = storeToRefs(timeRangeStore);
  const { variables, values, lastUpdatedAt, lastChangedNames } = storeToRefs(variablesStore as any);

  /**
   * 注意：不要把这些 Map 包进 Vue 响应式系统（reactive）
   *
   * 原因：
   * - reactive() 会对对象做代理，并可能在对象内部“解包 ref”
   * - 这里的 PanelQueryState 里包含 Ref，如果被解包/代理，容易出现 `.value` 写入异常
   *
   * 结论：
   * - registrations/varToPanels 只做内部 bookkeeping
   * - UI 响应式由每个 panel 自己的 refs（loading/error/results）来承载
   */
  const registrations = new Map<string, PanelRegistration>();
  const varToPanels = new Map<string, Set<string>>();

  /**
   * Visible panels (viewport + overscan) tracking
   *
   * 说明：
   * - 由渲染层（GridLayout 虚拟化 hook）上报“当前可视的 panel ids”
   * - scheduler 只刷新可视区域，避免 1000 panels 场景一次性堆满队列与请求风暴
   * - scopeId 用于多组 GridLayout 合并（union）
   */
  const visibleByScope = new Map<string, Set<string>>();
  const visiblePanels = new Set<string>();

  const recomputeVisible = (): Set<string> => {
    const next = new Set<string>();
    for (const set of visibleByScope.values()) {
      for (const id of set) next.add(id);
    }
    return next;
  };

  const isPanelVisible = (panelId: string) => visiblePanels.has(panelId);

  /**
   * Refresh queue (panel-level)
   *
   * 目标：
   * - 避免一次性对所有已注册 panel 触发 runPanel（即使 QueryRunner 有并发限制，也会产生大量任务与 abort 开销）
   * - 可视优先：priority 越高越先执行
   * - generation：timeRange/variables 变化时提升代际，过期任务不执行
   */
  const maxPanelConcurrency = 4;
  let panelInflight = 0;
  let queueGeneration = 0;
  let conditionGeneration = 0;
  const pending = new Map<string, RefreshTask>();

  const debug = ref<QuerySchedulerDebugSnapshot>({
    updatedAt: Date.now(),
    conditionGeneration: 0,
    queueGeneration: 0,
    registeredPanels: 0,
    visiblePanels: 0,
    pendingTasks: 0,
    inflightPanels: 0,
    maxPanelConcurrency,
    runnerMaxConcurrency: 6,
    runnerCacheTtlMs: 5_000,
    topPending: [],
  });

  const updateDebug = () => {
    const now = Date.now();
    const tasks = Array.from(pending.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.enqueuedAt - b.enqueuedAt;
      })
      .slice(0, 12)
      .map((t) => ({
        panelId: t.panelId,
        priority: t.priority,
        reason: t.reason,
        ageMs: now - t.enqueuedAt,
      }));

    debug.value = {
      updatedAt: now,
      conditionGeneration,
      queueGeneration,
      registeredPanels: registrations.size,
      visiblePanels: visiblePanels.size,
      pendingTasks: pending.size,
      inflightPanels: panelInflight,
      maxPanelConcurrency,
      runnerMaxConcurrency: 6,
      runnerCacheTtlMs: 5_000,
      topPending: tasks,
    };
  };

  const bumpQueueGeneration = () => {
    queueGeneration++;
    // Pending tasks are canceled; clear loading for those panels (unless already in-flight).
    for (const id of pending.keys()) {
      const reg = registrations.get(id);
      if (reg && !reg.inflight) reg.state.loading.value = false;
    }
    pending.clear();
    // Abort all in-flight panels so old requests don't waste network.
    for (const reg of registrations.values()) {
      reg.abort?.abort();
    }
    updateDebug();
  };

  const bumpConditionGeneration = () => {
    conditionGeneration++;
    bumpQueueGeneration();
  };

  const pickNextTask = (): RefreshTask | null => {
    let best: RefreshTask | null = null;
    for (const t of pending.values()) {
      if (!best) {
        best = t;
        continue;
      }
      if (t.priority !== best.priority) {
        if (t.priority > best.priority) best = t;
        continue;
      }
      if (t.enqueuedAt < best.enqueuedAt) best = t;
    }
    return best;
  };

  const drain = () => {
    while (panelInflight < maxPanelConcurrency && pending.size > 0) {
      const next = pickNextTask();
      if (!next) break;
      pending.delete(next.panelId);
      panelInflight++;
      updateDebug();

      void (async () => {
        const reg = registrations.get(next.panelId);
        if (!reg) return;
        if (!isPanelVisible(next.panelId) || next.generation !== queueGeneration) {
          // Task is dropped (visible-only policy / generation bump). Don't leave loading stuck.
          if (!reg.inflight) reg.state.loading.value = false;
          return;
        }
        await runPanel(reg);
      })().finally(() => {
        panelInflight--;
        updateDebug();
        drain();
      });
    }
  };

  const enqueue = (panelId: string, reason: RefreshReason, priority: number) => {
    const reg = registrations.get(panelId);
    if (!reg) return;
    if (!isPanelVisible(panelId)) return;

    const now = Date.now();
    // Simple per-panel debounce: don't enqueue too frequently.
    if (now - reg.lastEnqueuedAt < 300 && reason === 'became-visible') return;
    reg.lastEnqueuedAt = now;

    // Requirement: as long as a refresh is triggered/enqueued, show loading immediately,
    // even if the actual request will run later due to queue concurrency.
    // Also bump token to invalidate any delayed "loading off" timers from previous runs.
    reg.loadingToken = reg.loadingToken + 1;
    reg.state.loading.value = true;

    const existing = pending.get(panelId);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      existing.generation = queueGeneration;
      existing.reason = reason;
      updateDebug();
      return;
    }
    pending.set(panelId, { panelId, priority, generation: queueGeneration, reason, enqueuedAt: now });
    updateDebug();
    drain();
  };

  const variableMeta = computed(() => {
    const meta: Record<string, { includeAll?: boolean; allValue?: string; multi?: boolean }> = {};
    for (const v of (variables.value ?? []) as any[]) {
      meta[v.name] = { includeAll: v.includeAll, allValue: v.allValue, multi: v.multi };
    }
    return meta;
  });

  const computeDeps = (queries: CanonicalQuery[]): Set<string> => {
    const deps = new Set<string>();
    for (const q of queries) {
      // 依赖分析基于 expr 的变量引用（$var/${var}/[[var]]）
      extractVariableRefs(q.expr).forEach((name) => deps.add(name));
    }
    return deps;
  };

  const indexPanelDeps = (panelId: string, deps: Set<string>) => {
    // 移除旧依赖
    for (const [varName, panels] of varToPanels.entries()) {
      if (panels.has(panelId) && !deps.has(varName)) {
        panels.delete(panelId);
        if (!panels.size) varToPanels.delete(varName);
      }
    }
    // 添加新依赖
    for (const varName of deps) {
      const set = varToPanels.get(varName) ?? new Set<string>();
      set.add(panelId);
      varToPanels.set(varName, set);
    }
  };

  const runPanel = async (reg: PanelRegistration) => {
    const panel = reg.getPanel();
    const queries = panel.queries ?? [];
    reg.abort?.abort();
    reg.abort = new AbortController();

    const token = (reg.loadingToken = reg.loadingToken + 1);
    const startedAt = Date.now();
    reg.inflight = true;
    reg.state.loading.value = true;
    reg.state.error.value = '';

    const abs = absoluteTimeRange.value;
    const context: QueryContext = { timeRange: { from: abs.from, to: abs.to } };

    let aborted = false;
    try {
      const results = await runner.executeQueries(queries, context, values.value as any, variableMeta.value, { signal: reg.abort.signal });
      reg.state.results.value = results;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        aborted = true;
        return;
      }
      reg.state.error.value = err instanceof Error ? err.message : '查询失败';
    } finally {
      // Request finished (success / error / abort)
      reg.inflight = false;

      if (!aborted) {
        // Mark this panel as loaded for the current global condition.
        // This is the key to avoid “scroll -> remount -> reloading” when conditions didn't change.
        reg.lastLoadedConditionGen = conditionGeneration;
      }

      // Keep loading visible for a minimum time to avoid flicker (e.g. cache hit).
      // Important: do not block scheduler concurrency; delay only the UI flag.
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

      const clearIfStillValid = () => {
        // Don't clear if:
        // - a newer request has started (token changed)
        // - there is a pending refresh queued
        // - the panel is currently in-flight again
        if (reg.loadingToken !== token) return;
        if (reg.inflight) return;
        if (pending.has(reg.panelId)) return;
        reg.state.loading.value = false;
      };

      if (remaining <= 0) {
        clearIfStillValid();
      } else {
        globalThis.setTimeout(clearIfStillValid, remaining);
      }
    }
  };

  const refreshPanelsByNames = (panelIds: string[]) => {
    for (const id of panelIds) {
      enqueue(id, 'manual', 10);
    }
  };

  const refreshAll = () => {
    refreshPanelsByNames(Array.from(registrations.keys()));
  };

  const enqueueVisible = (reason: RefreshReason, priority: number) => {
    const ids = Array.from(visiblePanels);
    for (const id of ids) {
      enqueue(id, reason, priority);
    }
    updateDebug();
  };

  // 时间范围变化 -> 刷新全部面板
  watch(absoluteTimeRange, () => {
    bumpConditionGeneration();
    enqueueVisible('timeRange', 30);
  });

  // 变量变化 -> 只刷新受影响的面板（依赖分析）
  watch(lastUpdatedAt, () => {
    bumpConditionGeneration();
    const changed = (lastChangedNames.value ?? []) as string[];
    if (!changed.length) return;
    const affected = new Set<string>();
    for (const name of changed) {
      const panels = varToPanels.get(name);
      if (!panels) continue;
      panels.forEach((p) => affected.add(p));
    }
    // Only refresh the intersection with visible panels.
    for (const id of affected) {
      if (isPanelVisible(id)) enqueue(id, 'variables', 20);
    }
  });

  const registerPanel = (panelId: string, panelRef: Ref<Panel> | ComputedRef<Panel>): PanelQueryState => {
    const existing = registrations.get(panelId);

    const ensureQueryWatch = (reg: PanelRegistration) => {
      // Replace previous watch (virtualization remount will provide a new ref)
      reg.stopQueryWatch?.();
      reg.stopQueryWatch = watch(
        () => panelRef.value.queries,
        (next) => {
          const d = computeDeps(next ?? []);
          reg.deps = d;
          indexPanelDeps(panelId, d);
          enqueue(panelId, 'panel-change', 30);
        },
        { deep: true }
      );
    };

    if (existing) {
      existing.mounts++;
      existing.getPanel = () => panelRef.value;
      existing.deps = computeDeps(panelRef.value.queries ?? []);
      indexPanelDeps(panelId, existing.deps);
      ensureQueryWatch(existing);
      updateDebug();

      onBeforeUnmount(() => {
        existing.mounts = Math.max(0, existing.mounts - 1);
        existing.stopQueryWatch?.();
        existing.stopQueryWatch = undefined;
        // Remove from dependency index while unmounted: offscreen panels shouldn't participate.
        for (const panels of varToPanels.values()) {
          panels.delete(panelId);
        }
        // Avoid wasting work for a panel that is currently unmounted.
        pending.delete(panelId);
        if (!existing.inflight) existing.state.loading.value = false;
        updateDebug();
      });

      return existing.state;
    }

    const state: PanelQueryState = {
      loading: ref(false),
      error: ref(''),
      results: ref([]),
      refresh: () => {
        const reg = registrations.get(panelId);
        if (reg) enqueue(panelId, 'manual', 30);
      },
    };

    const reg: PanelRegistration = {
      panelId,
      getPanel: () => panelRef.value,
      deps: computeDeps(panelRef.value.queries ?? []),
      state,
      abort: null,
      lastEnqueuedAt: 0,
      inflight: false,
      loadingToken: 0,
      mounts: 1,
      lastLoadedConditionGen: -1,
    };
    registrations.set(panelId, reg);
    indexPanelDeps(panelId, reg.deps);
    ensureQueryWatch(reg);
    updateDebug();

    onBeforeUnmount(() => {
      reg.mounts = Math.max(0, reg.mounts - 1);
      reg.stopQueryWatch?.();
      reg.stopQueryWatch = undefined;
      for (const panels of varToPanels.values()) {
        panels.delete(panelId);
      }
      pending.delete(panelId);
      if (!reg.inflight) reg.state.loading.value = false;
      updateDebug();
    });

    return state;
  };

  return {
    /**
     * 注册面板（按 panelId 唯一）
     * - 返回该面板查询状态（UI 使用）
     */
    registerPanel,
    /**
     * 手动刷新全部面板（例如“刷新按钮”）
     */
    refreshAll,
    /**
     * 刷新当前可视区域（viewport + overscan）
     */
    refreshVisible: () => {
      bumpQueueGeneration();
      enqueueVisible('manual', 30);
    },
    /**
     * 清空 QueryRunner 缓存（下次执行会重新拉取）
     */
    invalidateAll: () => runner.invalidateAll(),
    /**
     * 上报某个 scope 的可视 panel ids（用于“只刷新可视区域”与虚拟化）
     */
    setVisiblePanels: (scopeId: string, panelIds: string[]) => {
      const prevVisible = new Set(visiblePanels);

      visibleByScope.set(scopeId, new Set(panelIds));
      const next = recomputeVisible();
      visiblePanels.clear();
      for (const id of next) visiblePanels.add(id);

      // Visible-only policy: drop pending tasks for panels that are no longer visible.
      for (const id of Array.from(pending.keys())) {
        if (visiblePanels.has(id)) continue;
        pending.delete(id);
        const reg = registrations.get(id);
        if (reg && !reg.inflight) reg.state.loading.value = false;
      }

      // Panels that just became visible -> enqueue a refresh (low latency).
      for (const id of visiblePanels) {
        if (prevVisible.has(id)) continue;
        const reg = registrations.get(id);
        if (!reg) continue;
        // Only refresh on visibility if:
        // - never loaded, OR
        // - global condition (timeRange/variables) changed since last load.
        if (reg.lastLoadedConditionGen !== conditionGeneration) {
          enqueue(id, 'became-visible', 25);
        }
      }
      updateDebug();
    },
    /**
     * 调度器调试信息（给回归验证/可观测性 UI 使用）
     */
    debug,
    /**
     * 获取当前调试快照（非响应式，适合一次性读取）
     */
    getDebugSnapshot: () => debug.value,
  };
}
