import { type ComputedRef, type InjectionKey, inject, computed } from 'vue';

/**
 * 组件尺寸预设
 *
 * - `small`  – 紧凑模式（24px 控件高度）
 * - `middle` – 默认模式（32px 控件高度）
 * - `large`  – 宽松模式（40px 控件高度）
 */
export type GfComponentSize = 'small' | 'middle' | 'large';

export interface GfSizeContext {
  size: ComputedRef<GfComponentSize>;
}

export const GF_SIZE_CONTEXT_KEY: InjectionKey<GfSizeContext> = Symbol('grafana-fast:size');

/**
 * 获取全局组件尺寸配置。
 *
 * 组件内部调用此函数，当 prop 未显式传入 size 时回退到全局配置；
 * 若全局也未配置，则使用 `fallback`（默认 `'middle'`）。
 *
 * @param propSize  - 组件 prop 中的 size 值（可能为 undefined）
 * @param fallback  - 当全局也未配置时的最终回退值
 */
export function useComponentSize(propSize: ComputedRef<string | undefined>, fallback: GfComponentSize = 'middle'): ComputedRef<string> {
  const ctx = inject(GF_SIZE_CONTEXT_KEY, null);
  return computed(() => propSize.value ?? ctx?.size.value ?? fallback);
}
