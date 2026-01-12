export const DASHBOARD_EMPTY_TEXT = '暂无面板组';
export const DEFAULT_DASHBOARD_NAME = 'Dashboard';

export function formatDashboardTitle(name?: string | null) {
  return name?.trim() || DEFAULT_DASHBOARD_NAME;
}
