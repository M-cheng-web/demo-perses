import type { DashboardSdkDashboardSummary, DashboardSdkStateSnapshot } from './types';

function isSameTimeRange(a: DashboardSdkStateSnapshot['timeRange'], b: DashboardSdkStateSnapshot['timeRange']): boolean {
  const af = String((a as any)?.from ?? '');
  const at = String((a as any)?.to ?? '');
  const bf = String((b as any)?.from ?? '');
  const bt = String((b as any)?.to ?? '');
  return af === bf && at === bt;
}

function isSameViewPanelId(a: DashboardSdkStateSnapshot['viewPanelId'], b: DashboardSdkStateSnapshot['viewPanelId']): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a.groupId) === String(b.groupId) && String(a.panelId) === String(b.panelId);
}

function isSameDashboardSummary(a: DashboardSdkDashboardSummary | null, b: DashboardSdkDashboardSummary | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a.sessionKey ?? '') === String(b.sessionKey ?? '') && a.name === b.name && a.groupCount === b.groupCount && a.panelCount === b.panelCount;
}

export function computeDashboardSdkChangedKeys(
  prev: DashboardSdkStateSnapshot | null,
  next: DashboardSdkStateSnapshot
): Array<keyof DashboardSdkStateSnapshot> {
  if (!prev) return Object.keys(next) as Array<keyof DashboardSdkStateSnapshot>;

  const changed: Array<keyof DashboardSdkStateSnapshot> = [];
  const mark = (key: keyof DashboardSdkStateSnapshot, same: boolean) => {
    if (!same) changed.push(key);
  };

  mark('instanceId', prev.instanceId === next.instanceId);
  mark('mounted', prev.mounted === next.mounted);
  mark('ready', prev.ready === next.ready);
  mark('containerSize', prev.containerSize.width === next.containerSize.width && prev.containerSize.height === next.containerSize.height);
  mark('theme', prev.theme === next.theme);
  mark('themePreference', prev.themePreference === next.themePreference);
  mark('readOnly', prev.readOnly === next.readOnly);
  mark('viewMode', prev.viewMode === next.viewMode);
  mark('isBooting', prev.isBooting === next.isBooting);
  mark('bootStage', prev.bootStage === next.bootStage);
  mark('isSaving', prev.isSaving === next.isSaving);
  mark('isSyncing', prev.isSyncing === next.isSyncing);
  mark('hasUnsyncedChanges', prev.hasUnsyncedChanges === next.hasUnsyncedChanges);
  mark('lastError', prev.lastError === next.lastError);
  mark('timeRange', isSameTimeRange(prev.timeRange, next.timeRange));
  mark('viewPanelId', isSameViewPanelId(prev.viewPanelId, next.viewPanelId));
  mark('dashboard', isSameDashboardSummary(prev.dashboard, next.dashboard));
  mark('variablesRevision', prev.variablesRevision === next.variablesRevision);
  mark('dashboardRevision', prev.dashboardRevision === next.dashboardRevision);

  return changed;
}
