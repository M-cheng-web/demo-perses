import type { ComputedRef, InjectionKey } from 'vue';

export type GfTheme = 'blue' | 'light' | 'dark' | 'inherit';
export type GfColorScheme = 'light' | 'dark' | undefined;

export interface GfThemeContext {
  theme: ComputedRef<GfTheme>;
  colorScheme: ComputedRef<GfColorScheme>;
  themeClass: ComputedRef<string | undefined>;
}

export const GF_THEME_CONTEXT_KEY: InjectionKey<GfThemeContext> = Symbol('grafana-fast:theme');

