/**
 * CSS Variable 工具
 */

export type CssVarName = `--${string}`;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveCssVarTarget(target?: HTMLElement | null): HTMLElement | null {
  if (!isBrowser()) return null;
  if (target && target.isConnected) return target;
  return document.documentElement;
}

/**
 * 读取 CSS 变量值
 *
 * @param target 目标元素（可选）；未传或不在 DOM 树上时会退回到 document.documentElement
 * @param name CSS 变量名（例如 "--gf-color-text"）
 * @param fallback 获取不到时的兜底值
 */
export function readCssVar(target: HTMLElement | null | undefined, name: CssVarName, fallback: string): string {
  if (!isBrowser()) return fallback;
  const el = resolveCssVarTarget(target);
  if (!el) return fallback;
  const value = getComputedStyle(el).getPropertyValue(name);
  return value?.trim() || fallback;
}

