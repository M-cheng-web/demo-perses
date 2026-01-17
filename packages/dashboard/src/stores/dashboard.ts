/**
 * Dashboard 状态管理
 */

import { defineStore } from '@grafana-fast/store';
import type { Dashboard, PanelGroup, Panel, PanelLayout, ID } from '@grafana-fast/types';
import { createPrefixedId, deepClone } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';

interface DashboardState {
  /** 当前 Dashboard */
  currentDashboard: Dashboard | null;
  /** 是否处于编辑模式 */
  isEditMode: boolean;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 全屏查看的面板 */
  viewPanelId: { groupId: ID; panelId: ID } | null;
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    currentDashboard: null,
    isEditMode: false,
    isSaving: false,
    viewPanelId: null,
  }),

  getters: {
    /**
     * 获取所有面板组
     */
    panelGroups(): PanelGroup[] {
      return this.currentDashboard?.panelGroups || [];
    },

    /**
     * 根据 ID 获取面板组
     */
    getPanelGroupById: (state) => (id: ID) => {
      return state.currentDashboard?.panelGroups.find((g) => g.id === id);
    },

    /**
     * 根据 ID 获取面板
     */
    getPanelById: (state) => (groupId: ID, panelId: ID) => {
      const group = state.currentDashboard?.panelGroups.find((g) => g.id === groupId);
      return group?.panels.find((p) => p.id === panelId);
    },

    /**
     * 获取当前全屏查看的面板
     */
    viewPanel(): Panel | null {
      if (!this.viewPanelId) return null;
      const { groupId, panelId } = this.viewPanelId;
      return this.getPanelById(groupId, panelId) || null;
    },

    /**
     * 是否有面板正在全屏查看
     */
    isPanelViewed(): boolean {
      return this.viewPanelId !== null;
    },
  },

  actions: {
    /**
     * 加载 Dashboard
     */
    async loadDashboard(id: ID) {
      try {
        const api = getPiniaApiClient();
        const dashboard = await api.dashboard.loadDashboard(id);
        // 按当前策略：不做历史 schema 兼容/迁移；API 返回什么就用什么（外部应保证是当前结构）。
        this.currentDashboard = deepClone(dashboard);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    },

    /**
     * 保存 Dashboard
     */
    async saveDashboard() {
      if (!this.currentDashboard) return;

      this.isSaving = true;
      try {
        const api = getPiniaApiClient();
        await api.dashboard.saveDashboard(this.currentDashboard);
      } catch (error) {
        console.error('Failed to save dashboard:', error);
        throw error;
      } finally {
        this.isSaving = false;
      }
    },

    /**
     * 切换编辑模式
     */
    toggleEditMode() {
      this.isEditMode = !this.isEditMode;
    },

    /**
     * 添加面板组
     */
    addPanelGroup(group: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;

      const newGroup: PanelGroup = {
        id: createPrefixedId('pg'),
        title: group.title || '新面板组',
        description: group.description,
        isCollapsed: false,
        order: this.currentDashboard.panelGroups.length,
        panels: [],
        layout: [],
      };

      this.currentDashboard.panelGroups.push(newGroup);
    },

    /**
     * 更新面板组
     */
    updatePanelGroup(id: ID, updates: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;

      const index = this.currentDashboard.panelGroups.findIndex((g) => g.id === id);
      if (index !== -1) {
        const currentGroup = this.currentDashboard.panelGroups[index];
        if (currentGroup) {
          this.currentDashboard.panelGroups[index] = {
            ...currentGroup,
            ...updates,
            id: currentGroup.id, // 确保id不被覆盖
            title: updates.title ?? currentGroup.title,
            isCollapsed: updates.isCollapsed ?? currentGroup.isCollapsed,
            order: updates.order ?? currentGroup.order,
            panels: updates.panels ?? currentGroup.panels,
            layout: updates.layout ?? currentGroup.layout,
          };
        }
      }
    },

    /**
     * 删除面板组
     */
    deletePanelGroup(id: ID) {
      if (!this.currentDashboard) return;

      this.currentDashboard.panelGroups = this.currentDashboard.panelGroups.filter((g) => g.id !== id);
    },

    /**
     * 移动面板组
     */
    movePanelGroup(fromIndex: number, toIndex: number) {
      if (!this.currentDashboard) return;

      const groups = this.currentDashboard.panelGroups;
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
    },

    /**
     * 更新面板组布局
     */
    updatePanelGroupLayout(groupId: ID, layout: PanelLayout[]) {
      if (!this.currentDashboard) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (group) {
        group.layout = layout;
      }
    },

    /**
     * 添加面板
     */
    addPanel(groupId: ID, panel: Panel) {
      if (!this.currentDashboard) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
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
    },

    /**
     * 更新面板
     */
    updatePanel(groupId: ID, panelId: ID, updates: Partial<Panel>) {
      if (!this.currentDashboard) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
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
    },

    /**
     * 删除面板
     */
    deletePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (!group) return;

      // 删除面板
      group.panels = group.panels.filter((p) => p.id !== panelId);

      // 删除布局
      group.layout = group.layout.filter((l) => l.i !== panelId);
    },

    /**
     * 复制面板
     */
    duplicatePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (!group) return;

      const panel = group.panels.find((p) => p.id === panelId);
      if (!panel) return;

      const newPanel: Panel = {
        ...deepClone(panel),
        id: createPrefixedId('p'),
        name: `${panel.name} (副本)`,
      };

      this.addPanel(groupId, newPanel);
    },

    /**
     * 设置全屏查看的面板
     */
    setViewPanel(groupId: ID | null, panelId: ID | null) {
      if (groupId && panelId) {
        this.viewPanelId = { groupId, panelId };
      } else {
        this.viewPanelId = null;
      }
    },

    /**
     * 切换面板的全屏状态
     */
    togglePanelView(groupId: ID, panelId: ID) {
      if (this.viewPanelId?.groupId === groupId && this.viewPanelId?.panelId === panelId) {
        this.setViewPanel(null, null);
      } else {
        this.setViewPanel(groupId, panelId);
      }
    },
  },
});
