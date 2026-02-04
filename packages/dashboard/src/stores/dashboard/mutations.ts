import type { ID, Panel, PanelGroup, PanelLayout } from '@grafana-fast/types';

import { createPrefixedId, deepClone } from '/#/utils';

import type { DashboardState, DashboardViewMode } from './types';

type DashboardMutationThis = DashboardState & {
  requestAutoSync: () => void;
  setViewMode: (mode: DashboardViewMode) => void;
  addPanel: (groupId: ID, panel: Panel) => void;
  setViewPanel: (groupId: ID | null, panelId: ID | null) => void;
};

type EditableDashboard = NonNullable<DashboardState['currentDashboard']>;

function getEditableDashboard(store: DashboardMutationThis): EditableDashboard | null {
  if (store.isBooting) return null;
  if (store.isReadOnly) return null;
  return store.currentDashboard;
}

/**
 * 设置当前可编辑的面板组
 *
 * 约束：
 * - “全部面板”视图只读：强制清空
 * - boot 阶段禁止编辑：强制清空
 */
export function setEditingGroup(this: DashboardMutationThis, groupId: ID | null) {
  if (this.isBooting) return;
  if (this.isReadOnly) {
    this.editingGroupId = null;
    return;
  }
  if (this.viewMode === 'allPanels') {
    this.editingGroupId = null;
    return;
  }
  this.editingGroupId = groupId;
}

/**
 * 切换某个面板组的编辑状态
 * - 若当前已在编辑该组：退出编辑
 * - 否则：进入编辑（并退出其他组的编辑）
 */
export function toggleGroupEditing(this: DashboardMutationThis, groupId: ID) {
  if (this.isBooting) return;
  if (this.isReadOnly) return;
  if (this.viewMode === 'allPanels') return;
  const key = String(groupId);
  if (this.editingGroupId != null && String(this.editingGroupId) === key) {
    this.editingGroupId = null;
    return;
  }
  this.editingGroupId = groupId;
}

/**
 * 切换视图模式（分组视图 <-> 全部面板视图）
 *
 * 说明：
 * - 全部面板视图只读：进入时自动退出编辑模式
 */
export function setViewMode(this: DashboardMutationThis, mode: DashboardViewMode) {
  if (this.isBooting) return;
  const next: DashboardViewMode = mode === 'allPanels' ? 'allPanels' : 'grouped';
  this.viewMode = next;
  if (next === 'allPanels') {
    this.editingGroupId = null;
  }
}

export function togglePanelsView(this: DashboardMutationThis) {
  this.setViewMode(this.viewMode === 'allPanels' ? 'grouped' : 'allPanels');
}

/**
 * 添加面板组
 */
export function addPanelGroup(this: DashboardMutationThis, group: Partial<PanelGroup>) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const newGroup: PanelGroup = {
    id: createPrefixedId('pg'),
    title: group.title || '新面板组',
    description: group.description,
    isCollapsed: true,
    order: dashboard.panelGroups.length,
    panels: [],
    layout: [],
  };

  dashboard.panelGroups.push(newGroup);
  this.requestAutoSync();
}

/**
 * 更新面板组
 */
export function updatePanelGroup(this: DashboardMutationThis, id: ID, updates: Partial<PanelGroup>) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const index = dashboard.panelGroups.findIndex((g) => g.id === id);
  if (index !== -1) {
    const currentGroup = dashboard.panelGroups[index];
    if (currentGroup) {
      dashboard.panelGroups[index] = {
        ...currentGroup,
        ...updates,
        id: currentGroup.id, // 确保id不被覆盖
        title: updates.title ?? currentGroup.title,
        // 面板组统一折叠：不再暴露/维护“折叠状态”字段
        isCollapsed: true,
        order: updates.order ?? currentGroup.order,
        panels: updates.panels ?? currentGroup.panels,
        layout: updates.layout ?? currentGroup.layout,
      };
    }
  }
  this.requestAutoSync();
}

/**
 * 删除面板组
 */
export function deletePanelGroup(this: DashboardMutationThis, id: ID) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  dashboard.panelGroups = dashboard.panelGroups.filter((g) => g.id !== id);
  this.requestAutoSync();
}

/**
 * 移动面板组
 */
export function movePanelGroup(this: DashboardMutationThis, fromIndex: number, toIndex: number) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const groups = dashboard.panelGroups;
  if (fromIndex < 0 || fromIndex >= groups.length || toIndex < 0 || toIndex >= groups.length) {
    return;
  }

  const [movedGroup] = groups.splice(fromIndex, 1);
  if (movedGroup) {
    groups.splice(toIndex, 0, movedGroup);

    // 更新 order
    groups.forEach((group, index) => {
      group.order = index;
    });
  }
  this.requestAutoSync();
}

/**
 * 批量重排面板组（用于拖拽排序）
 *
 * 说明：
 * - nextOrder 传入的是“面板组 id 的顺序数组”
 * - 会同时更新 currentDashboard.panelGroups 的数组顺序 + 每个 group.order
 * - 若 nextOrder 缺失/包含未知 id：会忽略未知项，并把缺失的组按原顺序追加到末尾（保证稳定）
 */
export function reorderPanelGroups(this: DashboardMutationThis, nextOrder: ID[]) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const groups = dashboard.panelGroups ?? [];
  if (!Array.isArray(groups) || groups.length === 0) return;

  const byId = new Map<string, PanelGroup>();
  for (const g of groups) byId.set(String(g.id), g);

  const used = new Set<string>();
  const next: PanelGroup[] = [];
  for (const rawId of nextOrder) {
    const key = String(rawId);
    const g = byId.get(key);
    if (!g) continue;
    if (used.has(key)) continue;
    used.add(key);
    next.push(g);
  }
  // 追加缺失的 group（保留原来的相对顺序）。
  for (const g of groups) {
    const key = String(g.id);
    if (used.has(key)) continue;
    used.add(key);
    next.push(g);
  }

  next.forEach((g, index) => {
    g.order = index;
  });
  dashboard.panelGroups = next;
  this.requestAutoSync();
}

/**
 * 更新面板组布局
 */
export function updatePanelGroupLayout(this: DashboardMutationThis, groupId: ID, layout: PanelLayout[]) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (group) {
    group.layout = layout;
  }
  this.requestAutoSync();
}

/**
 * 分页编辑模式：只更新当前页的 layout items（按 i 合并回全量 layout）
 *
 * 注意：
 * - 不会删除/新增 layout 项，仅更新已存在的项
 * - 仅作用于当前 group
 */
export function patchPanelGroupLayoutItems(this: DashboardMutationThis, groupId: ID, patch: PanelLayout[]) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (!group || !Array.isArray(group.layout) || group.layout.length === 0) return;

  const byId = new Map<string, PanelLayout>();
  for (const it of group.layout) byId.set(String(it.i), it);

  for (const next of patch) {
    const existing = byId.get(String(next.i));
    if (!existing) continue;
    Object.assign(existing, next);
  }
  this.requestAutoSync();
}

/**
 * 添加面板
 */
export function addPanel(this: DashboardMutationThis, groupId: ID, panel: Panel) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (!group) return;

  // 添加面板
  group.panels.push(panel);

  // 添加布局（默认放在最后）
  const maxY = Math.max(...group.layout.map((l) => l.y + l.h), 0);
  group.layout.push({
    i: panel.id,
    x: 0,
    y: maxY,
    w: 24,
    h: 8,
    minW: 6,
    minH: 4,
  });
  this.requestAutoSync();
}

/**
 * 更新面板
 */
export function updatePanel(this: DashboardMutationThis, groupId: ID, panelId: ID, updates: Partial<Panel>) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (!group) return;

  const index = group.panels.findIndex((p) => p.id === panelId);
  if (index !== -1) {
    const currentPanel = group.panels[index];
    if (currentPanel) {
      group.panels[index] = {
        ...currentPanel,
        ...updates,
        id: currentPanel.id, // 确保id不被覆盖
        name: updates.name ?? currentPanel.name,
        type: updates.type ?? currentPanel.type,
        queries: updates.queries ?? currentPanel.queries,
        options: updates.options ?? currentPanel.options,
      };
    }
  }
  this.requestAutoSync();
}

/**
 * 删除面板
 */
export function deletePanel(this: DashboardMutationThis, groupId: ID, panelId: ID) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (!group) return;

  // 删除面板
  group.panels = group.panels.filter((p) => p.id !== panelId);

  // 删除布局
  group.layout = group.layout.filter((l) => l.i !== panelId);
  this.requestAutoSync();
}

/**
 * 复制面板
 */
export function duplicatePanel(this: DashboardMutationThis, groupId: ID, panelId: ID) {
  const dashboard = getEditableDashboard(this);
  if (!dashboard) return;

  const group = dashboard.panelGroups.find((g) => g.id === groupId);
  if (!group) return;

  const panel = group.panels.find((p) => p.id === panelId);
  if (!panel) return;

  const newPanel: Panel = {
    ...deepClone(panel),
    id: createPrefixedId('p'),
    name: `${panel.name} (副本)`,
  };

  this.addPanel(groupId, newPanel);
}

/**
 * 设置全屏查看的面板
 */
export function setViewPanel(this: DashboardMutationThis, groupId: ID | null, panelId: ID | null) {
  if (groupId && panelId) {
    this.viewPanelId = { groupId, panelId };
  } else {
    this.viewPanelId = null;
  }
}

/**
 * 切换面板的全屏状态
 */
export function togglePanelView(this: DashboardMutationThis, groupId: ID, panelId: ID) {
  if (this.viewPanelId?.groupId === groupId && this.viewPanelId?.panelId === panelId) {
    this.setViewPanel(null, null);
  } else {
    this.setViewPanel(groupId, panelId);
  }
}
