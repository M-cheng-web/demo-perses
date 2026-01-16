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

    reg.state.loading.value = true;
    reg.state.error.value = '';

    const abs = absoluteTimeRange.value;
    const context: QueryContext = { timeRange: { from: abs.from, to: abs.to } };

    try {
      const results = await runner.executeQueries(queries, context, values.value as any, variableMeta.value, { signal: reg.abort.signal });
      reg.state.results.value = results;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      reg.state.error.value = err instanceof Error ? err.message : '查询失败';
    } finally {
      reg.state.loading.value = false;
    }
  };

  const refreshPanelsByNames = (panelIds: string[]) => {
    for (const id of panelIds) {
      const reg = registrations.get(id);
      if (reg) runPanel(reg);
    }
  };

  const refreshAll = () => {
    refreshPanelsByNames(Array.from(registrations.keys()));
  };

  // 时间范围变化 -> 刷新全部面板
  watch(absoluteTimeRange, () => {
    refreshAll();
  });

  // 变量变化 -> 只刷新受影响的面板（依赖分析）
  watch(lastUpdatedAt, () => {
    const changed = (lastChangedNames.value ?? []) as string[];
    if (!changed.length) return;
    const affected = new Set<string>();
    for (const name of changed) {
      const panels = varToPanels.get(name);
      if (!panels) continue;
      panels.forEach((p) => affected.add(p));
    }
    refreshPanelsByNames(Array.from(affected));
  });

  const registerPanel = (panelId: string, panelRef: Ref<Panel> | ComputedRef<Panel>): PanelQueryState => {
    const state: PanelQueryState = {
      loading: ref(false),
      error: ref(''),
      results: ref([]),
      refresh: () => {
        const reg = registrations.get(panelId);
        if (reg) runPanel(reg);
      },
    };

    const getPanel = () => panelRef.value;
    const deps = computeDeps(panelRef.value.queries ?? []);
    indexPanelDeps(panelId, deps);

    const reg: PanelRegistration = { panelId, getPanel, deps, state, abort: null };
    registrations.set(panelId, reg);

    // 追踪面板 query 变化：更新依赖索引，并刷新该面板
    watch(
      () => panelRef.value.queries,
      (next) => {
        const d = computeDeps(next ?? []);
        reg.deps = d;
        indexPanelDeps(panelId, d);
        state.refresh();
      },
      { deep: true }
    );

    // 首次注册时立即执行一次
    state.refresh();

    onBeforeUnmount(() => {
      reg.abort?.abort();
      registrations.delete(panelId);
      for (const panels of varToPanels.values()) {
        panels.delete(panelId);
      }
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
     * 清空 QueryRunner 缓存（下次执行会重新拉取）
     */
    invalidateAll: () => runner.invalidateAll(),
  };
}
