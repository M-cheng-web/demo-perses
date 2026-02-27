/**
 * Dashboard 组件通用常量与标题格式化工具。
 */
export const DASHBOARD_EMPTY_TEXT = '暂无面板组';
export const DEFAULT_DASHBOARD_NAME = 'Dashboard';

export function formatDashboardTitle(name?: string | null) {
  return name?.trim() || DEFAULT_DASHBOARD_NAME;
}
