export type DashboardTheme = 'light' | 'dark';
export type DashboardThemePreference = DashboardTheme | 'system';

export interface SetDashboardThemeOptions {
  /**
   * 是否把偏好写入 localStorage
   * 默认：true
   */
  persist?: boolean;
  /**
   * 是否将主题应用到全局 document（documentElement.dataset）
   *
   * 说明：
   * - 对“嵌入式 widget”场景，默认不建议修改宿主全局 document
   * - 当你明确在做“全站接管主题”的应用形态时，可以开启
   *
   * 默认：true（保持向后兼容）
   */
  apply?: boolean;
}

export interface InitDashboardThemeOptions extends SetDashboardThemeOptions {
  /**
   * 当 localStorage 中没有偏好时，回退到该偏好
   * 默认：'system'
   */
  defaultPreference?: DashboardThemePreference;
}

const STORAGE_KEY = 'grafana-fast:theme';
const DATASET_KEY = 'gfTheme';

function hasDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getSystemTheme(): DashboardTheme {
  if (!hasDom()) return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

export function getStoredThemePreference(): DashboardThemePreference | null {
  if (!hasDom()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    return null;
  } catch {
    return null;
  }
}

export function resolveTheme(preference: DashboardThemePreference): DashboardTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function getAppliedDashboardTheme(): DashboardTheme {
  if (!hasDom()) return 'light';
  const raw = document.documentElement?.dataset?.[DATASET_KEY];
  if (raw === 'light' || raw === 'dark') return raw;
  return getSystemTheme();
}

/**
 * 将 theme 应用到 document root（推荐的全局切换方式）：
 * - @grafana-fast/component 会读取 `:root[data-gf-theme="..."]` 响应 Token
 * - 如有需要，局部区域仍可通过 ConfigProvider / theme class 覆盖
 */
export function applyDashboardTheme(theme: DashboardTheme) {
  if (!hasDom()) return;
  document.documentElement.dataset[DATASET_KEY] = theme;
}

export function setDashboardThemePreference(preference: DashboardThemePreference, options: SetDashboardThemeOptions = {}): DashboardTheme {
  const { persist = true, apply = true } = options;
  const theme = resolveTheme(preference);
  if (apply) applyDashboardTheme(theme);

  if (hasDom() && persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignore
    }
  }

  return theme;
}

export function initDashboardTheme(options: InitDashboardThemeOptions = {}): DashboardTheme {
  const { defaultPreference = 'system', persist = true, apply = true } = options;
  const stored = getStoredThemePreference();
  return setDashboardThemePreference(stored ?? defaultPreference, { persist, apply });
}
