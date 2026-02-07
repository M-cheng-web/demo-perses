import type { CorePanelType } from '@grafana-fast/types';

export const BUILT_IN_PANEL_TYPES: CorePanelType[] = ['timeseries', 'pie', 'bar', 'table', 'stat', 'gauge', 'heatmap'];

const builtInPanelTypeSet = new Set<CorePanelType>(BUILT_IN_PANEL_TYPES);

export function listBuiltInPanelTypes(): CorePanelType[] {
  return [...BUILT_IN_PANEL_TYPES];
}

export function isBuiltInPanelType(type: unknown): type is CorePanelType {
  return typeof type === 'string' && builtInPanelTypeSet.has(type as CorePanelType);
}
