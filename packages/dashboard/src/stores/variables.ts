/**
 * Variables 状态管理（全局变量）
 *
 * 目标：
 * - 变量的“当前值/可选项”应是一个统一的运行时真相来源（Single Source of Truth）
 * - Dashboard JSON 中的 variables 负责“定义/默认值”；运行时 state 负责“当前值/options”
 *
 * 说明：
 * - 变量 options 的解析逻辑由 @grafana-fast/api 的 VariableService 实现层决定（mock/http）
 * - scheduler/QueryRunner 只需要读取当前 values 来做插值与刷新
 */

import { defineStore } from '@grafana-fast/store';
import type { DashboardVariable, VariableOption, VariablesState } from '@grafana-fast/types';
import { isPlainObject } from '@grafana-fast/utils';
import { deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { interpolateExpr } from '/#/query/interpolate';

interface VariablesStoreState {
  /** Dashboard JSON 中的变量定义（深拷贝保存，避免外部引用污染） */
  variables: DashboardVariable[];
  /** 运行时变量状态（values/options） */
  state: VariablesState;
  /** values 变化代际（用于 QueryScheduler 触发刷新） */
  valuesGeneration: number;
  /** options 变化代际（用于 UI 重新渲染下拉列表等，不一定触发查询刷新） */
  optionsGeneration: number;
  /** 是否正在解析 options（query 型变量） */
  isResolvingOptions: boolean;
  /** 最近一次错误（仅用于调试/展示；不会抛出以免阻断 dashboard 主流程） */
  lastError: string | null;
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

export const useVariablesStore = defineStore('variables', {
  state: (): VariablesStoreState => ({
    variables: [],
    state: emptyState(),
    valuesGeneration: 0,
    optionsGeneration: 0,
    isResolvingOptions: false,
    lastError: null,
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
     * 用 Dashboard JSON 中的变量定义初始化运行时状态
     *
     * 注意：
     * - 这一步只负责“初始化 values/options”，不会自动触发 query 刷新（由 QueryScheduler watch valuesGeneration 决定）
     */
    initializeFromDashboard(variables: DashboardVariable[] | undefined) {
      const list = deepCloneStructured(Array.isArray(variables) ? variables : []);
      this.variables = list;

      const api = getPiniaApiClient(this.$pinia);
      try {
        const next = api.variable.initialize(list);
        // 防御：避免实现层返回非对象导致后续崩溃
        if (!next || !isPlainObject(next) || !isPlainObject((next as any).values) || !isPlainObject((next as any).options)) {
          this.state = emptyState();
        } else {
          this.state = next;
        }
        this.lastError = null;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.state = emptyState();
      }

      // 初始化属于 values 的变化：会影响插值结果，因此 bump valuesGeneration
      this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
    },

    /**
     * 刷新 query 型变量的 options（以及其他变量的 options 归一化）
     *
     * 说明：
     * - options 通常用于 UI 下拉列表，不一定需要触发查询刷新
     * - 若你希望 options 变化也触发刷新，可在 QueryScheduler 里改为 watch optionsGeneration
     */
    async resolveOptions() {
      if (!this.variables.length) {
        this.state.options = {};
        this.state.lastUpdatedAt = Date.now();
        this.optionsGeneration = (this.optionsGeneration + 1) % Number.MAX_SAFE_INTEGER;
        return;
      }

      const api = getPiniaApiClient(this.$pinia);
      this.isResolvingOptions = true;
      try {
        // 对 query 型变量的 expr 做一次变量插值（与面板查询一致）：
        // - 前端完成 $var / ${var} / [[var]] 的替换后再交给后端/实现层解析
        // - 后端无需实现变量语法，降低接入复杂度
        const values = (this.state?.values ?? {}) as Record<string, string | string[]>;
        const interpolatedVariables = this.variables.map((v) => {
          if (v.type !== 'query') return v;
          const raw = String(v.query ?? '').trim();
          if (!raw) return v;
          const expr = interpolateExpr(raw, values, { multiFormat: 'regex', unknown: 'keep' });
          if (expr === raw) return v;
          return { ...v, query: expr };
        });

        const patch = await api.variable.resolveOptions(interpolatedVariables, this.state);
        const next: Record<string, VariableOption[]> = { ...(this.state.options ?? {}) };
        for (const [name, opts] of Object.entries(patch ?? {})) {
          next[name] = normalizeVariableOptions(opts);
        }
        this.state.options = next;
        this.state.lastUpdatedAt = Date.now();
        this.lastError = null;
        this.optionsGeneration = (this.optionsGeneration + 1) % Number.MAX_SAFE_INTEGER;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      } finally {
        this.isResolvingOptions = false;
      }
    },

    /**
     * 设置某个变量的当前值
     */
    setValue(name: string, value: string | string[]) {
      const key = String(name ?? '').trim();
      if (!key) return;
      const def = this.variables.find((v) => String(v.name) === key);
      const next = normalizeVariableValue(def, value);

      this.state.values = { ...(this.state.values ?? {}), [key]: next };
      this.state.lastUpdatedAt = Date.now();
      this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
    },

    /**
     * 批量设置变量值（常用于宿主一次性下发）
     */
    setValues(values: Record<string, string | string[]>) {
      if (!values || !isPlainObject(values)) return;
      const nextValues: Record<string, string | string[]> = { ...(this.state.values ?? {}) };
      for (const [name, value] of Object.entries(values)) {
        const key = String(name ?? '').trim();
        if (!key) continue;
        const def = this.variables.find((v) => String(v.name) === key);
        nextValues[key] = normalizeVariableValue(def, value);
      }
      this.state.values = nextValues;
      this.state.lastUpdatedAt = Date.now();
      this.valuesGeneration = (this.valuesGeneration + 1) % Number.MAX_SAFE_INTEGER;
    },
  },
});
