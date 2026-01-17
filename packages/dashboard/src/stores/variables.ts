/**
 * Variables 状态管理
 * - 统一处理变量 current/options
 * - 支持 query-based variable 的 options resolve（由 @grafana-fast/api 实现层决定）
 * - 提供 lastUpdatedAt 用于刷新调度（只刷新受影响面板）
 */

import { defineStore } from '@grafana-fast/store';
import type { Dashboard, DashboardVariable, VariableOption, VariablesState } from '@grafana-fast/types';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';

interface VariablesStoreState extends VariablesState {
  /** 当前 dashboard 的变量定义（来自 Dashboard JSON） */
  variables: DashboardVariable[];
  /** 最近一次变更的变量名（用于依赖分析精准刷新） */
  lastChangedNames: string[];
}

function normalizeValue(variable: DashboardVariable): string | string[] {
  const current = variable.current;
  if (variable.multi) {
    if (Array.isArray(current)) return current;
    if (typeof current === 'string' && current) return [current];
    return [];
  }
  if (Array.isArray(current)) return String(current[0] ?? '');
  return String(current ?? '');
}

export const useVariablesStore = defineStore('variables', {
  state: (): VariablesStoreState => ({
    variables: [],
    values: {},
    options: {},
    lastUpdatedAt: Date.now(),
    lastChangedNames: [],
  }),

  getters: {
    getValue: (state) => (name: string) => state.values[name],
    getOptions: (state) => (name: string) => state.options[name] ?? [],
  },

  actions: {
    /**
     * 初始化变量（通常在 dashboard load/import 后调用）
     */
    async initializeFromDashboard(dashboard: Dashboard | null) {
      const api = getPiniaApiClient(this.$pinia);
      const vars = dashboard?.variables ?? [];
      this.variables = vars;

      const initial = api.variable.initialize(vars);
      this.values = initial.values;
      this.options = initial.options;
      this.lastUpdatedAt = Date.now();

      // Resolve query-based variable options (best-effort)
      try {
        const resolved = await api.variable.resolveOptions(vars, initial);
        this.options = { ...this.options, ...resolved };
      } catch {
        // ignore; callers can retry later
      } finally {
        this.lastUpdatedAt = Date.now();
      }
    },

    /**
     * 更新单个变量值
     */
    setVariableValue(name: string, value: string | string[]) {
      const prev = this.values[name];
      this.values = { ...this.values, [name]: value };
      this.lastChangedNames = prev === value ? [] : [name];
      this.lastUpdatedAt = Date.now();
    },

    /**
     * 批量更新变量值（来自 VariableSelector）
     */
    setValues(next: Record<string, string | string[]>) {
      const changed: string[] = [];
      const merged = { ...this.values, ...next };
      for (const [k, v] of Object.entries(next)) {
        if (this.values[k] !== v) changed.push(k);
      }
      this.values = merged;
      this.lastChangedNames = changed;
      this.lastUpdatedAt = Date.now();
    },

    /**
     * 将运行时 values 写回 Dashboard JSON（用于导出/持久化）
     * - 不会自动保存到后端；仅同步 store.currentDashboard
     */
    applyToDashboard(dashboard: Dashboard | null) {
      if (!dashboard?.variables) return;
      const nextVars = dashboard.variables.map((v) => {
        const next = this.values[v.name];
        const normalized = next == null ? normalizeValue(v) : next;
        return { ...v, current: normalized } as DashboardVariable;
      });
      dashboard.variables = nextVars;
    },

    /**
     * 直接更新某个变量的 options（用于 query-based variables）
     */
    setOptions(name: string, options: VariableOption[]) {
      this.options = { ...this.options, [name]: options };
      this.lastChangedNames = [];
      this.lastUpdatedAt = Date.now();
    },
  },
});
