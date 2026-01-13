export type DashboardTheme = 'light' | 'dark';
export type DashboardThemePreference = DashboardTheme | 'system';

export interface SetDashboardThemeOptions {
  /**
   * Whether to persist the preference in localStorage.
   * Defaults to true.
   */
  persist?: boolean;
}

export interface InitDashboardThemeOptions extends SetDashboardThemeOptions {
  /**
   * When there is no stored preference, fall back to this preference.
   * Defaults to 'system'.
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
 * Apply theme to the document root. This is the recommended global switch:
 * - Tokens in @grafana-fast/component react to :root[data-gf-theme="..."]
 * - Any subtree can still override via ConfigProvider/theme class if needed
 */
export function applyDashboardTheme(theme: DashboardTheme) {
  if (!hasDom()) return;
  document.documentElement.dataset[DATASET_KEY] = theme;
}

export function setDashboardThemePreference(
  preference: DashboardThemePreference,
  options: SetDashboardThemeOptions = {}
): DashboardTheme {
  const { persist = true } = options;
  const theme = resolveTheme(preference);
  applyDashboardTheme(theme);

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
  const { defaultPreference = 'system', persist = true } = options;
  const stored = getStoredThemePreference();
  return setDashboardThemePreference(stored ?? defaultPreference, { persist });
}

