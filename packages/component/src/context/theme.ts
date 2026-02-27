/**
 * 主题上下文：提供 light/dark 与 colorScheme/themeClass 的注入 key。
 */
import type { ComputedRef, InjectionKey } from 'vue';

export type GfTheme = 'light' | 'dark';
export type GfColorScheme = 'light' | 'dark' | undefined;

export interface GfThemeContext {
  theme: ComputedRef<GfTheme>;
  colorScheme: ComputedRef<GfColorScheme>;
  themeClass: ComputedRef<string | undefined>;
}

export const GF_THEME_CONTEXT_KEY: InjectionKey<GfThemeContext> = Symbol('grafana-fast:theme');
