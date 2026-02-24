/**
 * Variables 状态管理（全局变量）
 *
 * 本项目采用“后端全量下发变量”的模式：
 * - Dashboard JSON 不承载 variables（不导入/导出，不随 dashboards/load round-trip）
 * - 后端根据 dashboardSessionKey 返回该 dashboard 需要的变量（定义 + options + current 默认值）
 * - 前端必须先 loadVariables 再进入 Dashboard ready（避免首屏查询出现 $cluster 未替换等问题）
 *
 * 说明：
 * - 调用方只依赖 variablesStore.state.values 做插值（QueryScheduler -> PanelRunner）
 * - 若后端返回变量结构不合法：前端应兜底不崩，并把错误暴露给 UI（message/lastError）
 */

import { defineStore } from '@grafana-fast/store';
import type { DashboardSessionKey, DashboardVariable, VariableOption, VariablesState } from '@grafana-fast/types';
import { isPlainObject } from '@grafana-fast/utils';
import { deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';

interface VariablesStoreState {
  /** 后端下发的变量定义（深拷贝保存，避免外部引用污染） */
  variables: DashboardVariable[];
  /** 运行时变量状态（values/options） */
  state: VariablesState;
  /** values 变化代际（用于 QueryScheduler 触发刷新） */
  valuesGeneration: number;
  /** options 变化代际（用于 UI 重新渲染下拉列表等，不一定触发查询刷新） */
  optionsGeneration: number;
  /** 是否正在加载变量（loadVariables） */
  isLoading: boolean;
  /** 是否正在应用变量（applyVariables） */
  isApplying: boolean;
  /** 最近一次错误（仅用于调试/展示；不会抛出以免阻断 dashboard 主流程） */
  lastError: string | null;
  /** 最近一次成功 load 的 sessionKey（用于调试/避免跨 dashboard 串数据） */
  loadedSessionKey: DashboardSessionKey | null;
}

function emptyState(): VariablesState {
  return { values: {}, options: {}, lastUpdatedAt: Date.now() };
}

function normalizeVariableValue(def: DashboardVariable | undefined, value: unknown): string | string[] {
  const multi = !!def?.multi;
  if (multi) {
    if (Array.isArray(value)) return value.map((v) => String(v));
    const v = String(value ?? '').trim();
    return v ? [v] : [];
  }
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function normalizeVariableOptions(options: VariableOption[] | undefined): VariableOption[] {
  return (options ?? []).map((opt) => ({ text: String(opt.text ?? opt.value ?? ''), value: String(opt.value ?? opt.text ?? '') }));
}

function normalizeVariableFromServer(raw: DashboardVariable): DashboardVariable | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String((raw as any).id ?? '').trim();
  const name = String((raw as any).name ?? '').trim();
  const label = String((raw as any).label ?? name).trim();
  const type = String((raw as any).type ?? '').trim();

  // 最小约束：必须有 name/type（id 可由后端决定是否稳定；前端仅用于 key）
  if (!name) return null;
  if (type !== 'select' && type !== 'input' && type !== 'constant' && type !== 'query') return null;

  const multi = Boolean((raw as any).multi);
  const includeAll = Boolean((raw as any).includeAll);
  const allValue = (raw as any).allValue != null ? String((raw as any).allValue) : undefined;

  const query = (raw as any).query != null ? String((raw as any).query) : undefined;
  const options = normalizeVariableOptions(Array.isArray((raw as any).options) ? ((raw as any).options as VariableOption[]) : []);
  const current = normalizeVariableValue({ multi } as DashboardVariable, (raw as any).current);

  return {
    ...(raw as any),
    id: id || name,
    name,
    label,
    type: type as DashboardVariable['type'],
    query,
    options,
    current,
    multi: multi || undefined,
    includeAll: includeAll || undefined,
    allValue,
  } satisfies DashboardVariable;
}

function deriveRuntimeStateFromVariables(list: DashboardVariable[]): VariablesState {
  const values: Record<string, string | string[]> = {};
  const options: Record<string, VariableOption[]> = {};

  for (const v of list) {
    const name = String(v?.name ?? '').trim();
    if (!name) continue;
    values[name] = normalizeVariableValue(v, v.current);
    options[name] = normalizeVariableOptions(v.options);
  }

  return { values, options, lastUpdatedAt: Date.now() };
}

export const useVariablesStore = defineStore('variables', {
  state: (): VariablesStoreState => ({
    variables: [],
    state: emptyState(),
    valuesGeneration: 0,
    optionsGeneration: 0,
    isLoading: false,
    isApplying: false,
    lastError: null,
    loadedSessionKey: null,
  }),

  getters: {
    /**
     * 获取某个变量定义（按 name）
     */
    getVariableDef:
      (state) =>
      (name: string): DashboardVariable | undefined =>
        state.variables.find((v) => String(v.name) === String(name)),

    /**
     * 获取某个变量当前值（按 name）
     */
    getValue:
      (state) =>
      (name: string): string | string[] | undefined =>
        state.state.values[String(name)],

    /**
     * 获取某个变量 options（按 name）
     */
    getOptions:
      (state) =>
      (name: string): VariableOption[] =>
        state.state.options[String(name)] ?? [],
  },

  actions: {
    /**
     * 清空变量（切换 dashboard / boot 前可用）
     */
    reset() {
      this.variables = [];
      this.state = emptyState();
      this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
      this.optionsGeneration = (this.optionsGeneration + 1) % Number.MAX_SAFE_INTEGER;
      this.isLoading = false;
      this.isApplying = false;
      this.lastError = null;
      this.loadedSessionKey = null;
    },

    _applyVariablesListFromServer(rawList: DashboardVariable[], dashboardSessionKey: DashboardSessionKey) {
      const normalized: DashboardVariable[] = [];
      const seenByName = new Set<string>();
      const invalid: Array<{ index: number; reason: string }> = [];

      (Array.isArray(rawList) ? rawList : []).forEach((raw, index) => {
        const v = normalizeVariableFromServer(raw);
        if (!v) {
          invalid.push({ index, reason: 'invalid shape' });
          return;
        }
        const name = String(v.name ?? '').trim();
        if (!name) {
          invalid.push({ index, reason: 'missing name' });
          return;
        }
        if (seenByName.has(name)) {
          invalid.push({ index, reason: `duplicate name: ${name}` });
          return;
        }
        seenByName.add(name);
        normalized.push(v);
      });

      this.variables = deepCloneStructured(normalized);
      this.state = deriveRuntimeStateFromVariables(normalized);
      this.loadedSessionKey = dashboardSessionKey;

      // values/options 都可能变化：统一 bump（简单可靠）
      this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
      this.optionsGeneration = (this.optionsGeneration + 1) % Number.MAX_SAFE_INTEGER;

      if (invalid.length > 0) {
        const head = invalid.slice(0, 3).map((it) => `#${it.index}(${it.reason})`).join(', ');
        const more = invalid.length > 3 ? ` ...(+${invalid.length - 3})` : '';
        this.lastError = `变量返回部分不合法，已忽略：${head}${more}`;
      } else {
        this.lastError = null;
      }
    },

    /**
     * 加载整份变量定义（后端全量下发）
     *
     * 重要：该 action 建议在 Dashboard boot 过程中 await（阻塞进入 ready）。
     */
    async loadVariables(dashboardSessionKey: DashboardSessionKey) {
      const sessionKey = String(dashboardSessionKey ?? '').trim();
      if (!sessionKey) throw new Error('Missing dashboardSessionKey');

      const api = getPiniaApiClient(this.$pinia);
      this.isLoading = true;
      try {
        const res = await api.variable.loadVariables({ dashboardSessionKey: sessionKey });
        if (!Array.isArray(res)) throw new Error('Invalid LoadVariablesResponse: expected DashboardVariable[]');
        const apply = this._applyVariablesListFromServer;
        if (typeof apply !== 'function') {
          throw new Error('[grafana-fast] VariablesStore internal helper is missing: _applyVariablesListFromServer');
        }
        apply.call(this, res as DashboardVariable[], sessionKey);
        return this.variables;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.lastError = `加载变量失败：${msg}`;
        this.variables = [];
        this.state = emptyState();
        this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
        this.optionsGeneration = (this.optionsGeneration + 1) % Number.MAX_SAFE_INTEGER;
        this.loadedSessionKey = null;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 应用变量值并回写默认值（由后端决定是否持久化），返回整份变量定义
     */
    async applyVariables(dashboardSessionKey: DashboardSessionKey, values: Record<string, string | string[]>) {
      const sessionKey = String(dashboardSessionKey ?? '').trim();
      if (!sessionKey) throw new Error('Missing dashboardSessionKey');
      const patch = values && isPlainObject(values) ? values : {};

      const api = getPiniaApiClient(this.$pinia);
      this.isApplying = true;
      try {
        const res = await api.variable.applyVariables(deepCloneStructured(patch) as Record<string, string | string[]>, { dashboardSessionKey: sessionKey });
        if (!Array.isArray(res)) throw new Error('Invalid ApplyVariablesResponse: expected DashboardVariable[]');
        const apply = this._applyVariablesListFromServer;
        if (typeof apply !== 'function') {
          throw new Error('[grafana-fast] VariablesStore internal helper is missing: _applyVariablesListFromServer');
        }
        apply.call(this, res as DashboardVariable[], sessionKey);
        return this.variables;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.lastError = `应用变量失败：${msg}`;
        throw error;
      } finally {
        this.isApplying = false;
      }
    },
  },
});
