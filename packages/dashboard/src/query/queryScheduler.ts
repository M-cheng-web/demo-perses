/**
 * QueryScheduler（调度层）
 *
 * 目标：
 * - 把“查询触发”从各处 watch 里收敛到一个中心调度器
 * - 统一处理：timeRange 变化、面板 query 变化 -> 触发刷新
 *
 * 结构：
 * - registerPanel(panelId, panelRef) 注册一个面板（返回该面板的 loading/error/results/refreh）
 * - 内部使用 QueryRunner 执行（并发/缓存/取消）
 *
 * 注意：
 * - 这个调度器应是“按 dashboard 实例隔离”的（通常绑定到 pinia 实例）
 */
import { onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Panel, QueryContext, QueryResult } from '@grafana-fast/types';
import { storeToRefs, type Pinia } from '@grafana-fast/store';
import { useTimeRangeStore, useVariablesStore } from '/#/stores';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { QueryRunner } from './queryRunner';
import { interpolateExpr } from './interpolate';

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
   * - 条件代际只在 timeRange 变化时递增
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

/**
 * 创建一个 QueryScheduler 实例
 *
 * @param pinia 可选：绑定到指定 pinia 实例（推荐用于多 dashboard 同页挂载）
 *
 * 行为：
 * - 追踪已注册 panel
 * - timeRange 变化 -> 全量刷新
 * - 面板 queries 变化 -> 刷新该 panel
 */
export function createQueryScheduler(pinia?: Pinia) {
  const api = getPiniaApiClient(pinia);
  const runner = new QueryRunner(api, { maxConcurrency: 6, cacheTtlMs: 5_000 });
  const MIN_LOADING_MS = 200;

  const timeRangeStore = useTimeRangeStore(pinia);
  const { absoluteTimeRange } = storeToRefs(timeRangeStore);
  const variablesStore = useVariablesStore(pinia);
  const { valuesGeneration } = storeToRefs(variablesStore);

  /**
   * 注意：不要把这些 Map 包进 Vue 响应式系统（reactive）
   *
   * 原因：
   * - reactive() 会对对象做代理，并可能在对象内部“解包 ref”
   * - 这里的 PanelQueryState 里包含 Ref，如果被解包/代理，容易出现 `.value` 写入异常
   *
   * 结论：
   * - registrations 只做内部 bookkeeping
   * - UI 响应式由每个 panel 自己的 refs（loading/error/results）来承载
   */
  const registrations = new Map<string, PanelRegistration>();

  /**
   * 可视面板跟踪（viewport + overscan）
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
   * 刷新队列（panel 级别）
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
      return;
    }
    pending.set(panelId, { panelId, priority, generation: queueGeneration, reason, enqueuedAt: now });
    drain();
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
      const values = (variablesStore.state?.values ?? {}) as Record<string, string | string[]>;
      const resolvedQueries = queries.map((q) => {
        const rawExpr = String(q.expr ?? '');
        const expr = interpolateExpr(rawExpr, values, { multiFormat: 'regex', unknown: 'keep' });
        // Avoid object churn if expr doesn't change.
        return expr === rawExpr ? q : { ...q, expr };
      });

      const results = await runner.executeQueries(resolvedQueries, context, { signal: reg.abort.signal });
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
  };

  // 时间范围变化 -> 刷新全部面板
  watch(absoluteTimeRange, () => {
    bumpConditionGeneration();
    enqueueVisible('timeRange', 30);
  });

  // 变量值变化 -> 刷新可视面板（优先级略低于 timeRange）
  watch(valuesGeneration, () => {
    bumpConditionGeneration();
    enqueueVisible('variables', 28);
  });

  const registerPanel = (panelId: string, panelRef: Ref<Panel> | ComputedRef<Panel>): PanelQueryState => {
    const existing = registrations.get(panelId);

    const ensureQueryWatch = (reg: PanelRegistration) => {
      // Replace previous watch (virtualization remount will provide a new ref)
      reg.stopQueryWatch?.();
      reg.stopQueryWatch = watch(
        () => panelRef.value.queries,
        () => {
          enqueue(panelId, 'panel-change', 30);
        },
        { deep: true }
      );
    };

    if (existing) {
      existing.mounts++;
      existing.getPanel = () => panelRef.value;
      ensureQueryWatch(existing);
      /**
       * 兼容虚拟化/窗口化的“注册时机”：
       * - 在虚拟滚动场景下，渲染层可能先上报了 visiblePanels，再 mount PanelContent（再注册）
       * - 如果此时不补一次 enqueue，就会出现“永远不触发首屏请求”的情况（queryResults 为空 -> chart 一直转圈）
       *
       * 这里的原则：
       * - 只要 panel 当前可见，并且在当前条件代际下从未成功加载过，就触发一次 became-visible 刷新
       * - 已加载过的 panel（lastLoadedConditionGen === conditionGeneration）不重复刷新，避免滚动导致重复请求
       */
      if (isPanelVisible(panelId) && existing.lastLoadedConditionGen !== conditionGeneration) {
        enqueue(panelId, 'became-visible', 25);
      }

      onBeforeUnmount(() => {
        existing.mounts = Math.max(0, existing.mounts - 1);
        existing.stopQueryWatch?.();
        existing.stopQueryWatch = undefined;
        // Avoid wasting work for a panel that is currently unmounted.
        pending.delete(panelId);
        if (!existing.inflight) existing.state.loading.value = false;
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
      state,
      abort: null,
      lastEnqueuedAt: 0,
      inflight: false,
      loadingToken: 0,
      mounts: 1,
      lastLoadedConditionGen: -1,
    };
    registrations.set(panelId, reg);
    ensureQueryWatch(reg);
    // 同上：确保“先上报可见、后注册”的情况下也能触发首屏请求
    if (isPanelVisible(panelId) && reg.lastLoadedConditionGen !== conditionGeneration) {
      enqueue(panelId, 'became-visible', 25);
    }

    onBeforeUnmount(() => {
      reg.mounts = Math.max(0, reg.mounts - 1);
      reg.stopQueryWatch?.();
      reg.stopQueryWatch = undefined;
      pending.delete(panelId);
      if (!reg.inflight) reg.state.loading.value = false;
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

      /**
       * 关键优化：当 panel 不再可视，并且该 panel 的组件实例已卸载（mounts===0）时，
       * 主动 abort 该 panel 的 in-flight 请求。
       *
       * 为什么需要：
       * - “可视优先刷新”本身已经避免了大量 pending 任务，但 in-flight 请求仍可能继续占用网络/CPU
       * - 在“分页切换 / 切换聚焦组”时，上一页/上一组的 panel 会整体卸载：
       *   - 如果不 abort，旧请求返回后仍会写入 state.results（浪费且可能造成调试困惑）
       * - 在纯滚动场景下，频繁 abort 会引入抖动与重复请求，因此这里加了 mounts===0 的限制：
       *   - 仍挂载（例如 keepAlive/pinned）的 panel，不会因为临时不可视就被打断
       *   - 只有真正被卸载的 panel 才会取消请求，符合“用户已离开该页面/该组”的直觉
       */
      for (const id of prevVisible) {
        if (visiblePanels.has(id)) continue;
        const reg = registrations.get(id);
        if (!reg) continue;
        if (!reg.inflight) continue;
        if (reg.mounts > 0) continue;
        reg.abort?.abort();
        // 组件已卸载：避免留下一个“永远 loading=true” 的旧状态（下次出现会重新 enqueue）
        reg.state.loading.value = false;
      }

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
    },
  };
}
