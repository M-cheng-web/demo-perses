/**
 * Dashboard 状态管理
 */

import { defineStore } from '@grafana-fast/store';
import type { Dashboard, PanelGroup, Panel, PanelLayout, ID } from '@grafana-fast/types';
import { createPrefixedId, deepClone, deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';

type BootStage = 'idle' | 'fetching' | 'parsing' | 'initializing' | 'ready' | 'error';
type DashboardViewMode = 'grouped' | 'allPanels';

interface DashboardState {
  /** 当前 Dashboard */
  currentDashboard: Dashboard | null;
  /**
   * 当前处于“可编辑”状态的面板组（仅允许一个）
   *
   * 设计说明：
   * - 本项目已移除“全局编辑模式”的概念（避免虚拟滚动 + 拖拽缩放交互过于复杂）
   * - 只有当前打开的面板组允许编辑其子面板（拖拽/缩放/复制/删除等）
   */
  editingGroupId: ID | null;
  /** 视图模式：分组视图 / 全部面板视图（只读） */
  viewMode: DashboardViewMode;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 最近一次 load/save 的错误（用于 UI 展示与宿主接管） */
  lastError: string | null;
  /** 全屏查看的面板 */
  viewPanelId: { groupId: ID; panelId: ID } | null;
  /** 是否处于“加载/初始化”中（加载时应锁住交互） */
  isBooting: boolean;
  /** boot 阶段（用于 UI 展示更明确的状态） */
  bootStage: BootStage;
  /** boot 过程统计（用于提示“数据量大，需要等待”） */
  bootStats: {
    startedAt: number | null;
    groupCount: number | null;
    panelCount: number | null;
    jsonBytes: number | null;
    source: 'remote' | 'import' | null;
  };
}

const BIG_DASHBOARD_PANEL_THRESHOLD = 200;
const BIG_DASHBOARD_JSON_BYTES_THRESHOLD = 2 * 1024 * 1024; // 2MB

function yieldToPaint(): Promise<void> {
  // 用 setTimeout(0) 让浏览器有机会先渲染 loading mask，避免“先卡住再出现遮罩”
  return new Promise((r) => window.setTimeout(r, 0));
}

function safeUtf8Bytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    // fallback: 近似值（UTF-16 code units）
    return text.length * 2;
  }
}

function countDashboardStats(d: Dashboard): { groupCount: number; panelCount: number } {
  const groups = d.panelGroups ?? [];
  let panelCount = 0;
  for (const g of groups) {
    panelCount += g.panels?.length ?? 0;
  }
  return { groupCount: groups.length, panelCount };
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    currentDashboard: null,
    editingGroupId: null,
    viewMode: 'grouped',
    isSaving: false,
    lastError: null,
    viewPanelId: null,
    isBooting: false,
    bootStage: 'idle',
    bootStats: { startedAt: null, groupCount: null, panelCount: null, jsonBytes: null, source: null },
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

    /**
     * 是否为“大数据 Dashboard”（用于提示用户耐心等待）
     */
    isLargeDashboard(): boolean {
      const panels = this.bootStats.panelCount ?? this.currentDashboard?.panelGroups?.reduce((n, g) => n + (g.panels?.length ?? 0), 0) ?? 0;
      const bytes = this.bootStats.jsonBytes ?? 0;
      return panels >= BIG_DASHBOARD_PANEL_THRESHOLD || bytes >= BIG_DASHBOARD_JSON_BYTES_THRESHOLD;
    },

    /**
     * 当前面板组是否处于可编辑状态（仅打开态的组才会被设置为 editingGroupId）
     */
    isGroupEditing: (state) => (groupId: ID): boolean => {
      if (state.isBooting) return false;
      if (state.viewMode === 'allPanels') return false;
      return state.editingGroupId != null && String(state.editingGroupId) === String(groupId);
    },
  },

  actions: {
    beginBoot(source: 'remote' | 'import', stage: BootStage) {
      this.isBooting = true;
      this.bootStage = stage;
      this.lastError = null;
      this.viewPanelId = null;
      // boot 中禁止编辑：锁住交互，避免“半初始化状态”产生不一致
      this.editingGroupId = null;
      this.viewMode = 'grouped';
      this.bootStats = {
        startedAt: Date.now(),
        groupCount: null,
        panelCount: null,
        jsonBytes: null,
        source,
      };
    },

    finishBoot() {
      this.bootStage = 'ready';
      this.isBooting = false;
    },

    failBoot(message: string) {
      this.lastError = message;
      this.bootStage = 'error';
      this.isBooting = false;
    },

    /**
     * 加载 Dashboard
     */
    async loadDashboard(id: ID) {
      this.beginBoot('remote', 'fetching');
      try {
        await yieldToPaint();
        const api = getPiniaApiClient(this.$pinia);
        const dashboard = await api.dashboard.loadDashboard(id);
        this.bootStage = 'initializing';
        await yieldToPaint();

        const { groupCount, panelCount } = countDashboardStats(dashboard);
        this.bootStats.groupCount = groupCount;
        this.bootStats.panelCount = panelCount;

        // 按当前策略：不做历史 schema 兼容/迁移；API 返回什么就用什么（外部应保证是当前结构）。
        // 大 JSON 下用 structuredClone 降低 stringify/parse 的主线程压力。
        const next = deepCloneStructured(dashboard);
        this.currentDashboard = next;
        this.finishBoot();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load dashboard';
        this.failBoot(message);
        console.error('Failed to load dashboard:', error);
        throw error;
      }
    },

    /**
     * 从 JSON 导入/应用 Dashboard（用于 DashboardToolbar 的 JSON 编辑器）
     *
     * 注意：
     * - rawJsonText 用于统计 bytes（提示“数据量较大，需要等待”）
     * - dashboard 对象已由编辑器严格校验通过
     */
    async applyDashboardFromJson(dashboard: Dashboard, rawJsonText?: string) {
      this.beginBoot('import', 'parsing');
      try {
        if (typeof rawJsonText === 'string' && rawJsonText.trim()) {
          this.bootStats.jsonBytes = safeUtf8Bytes(rawJsonText);
        }

        await yieldToPaint();
        this.bootStage = 'initializing';
        await yieldToPaint();

        const { groupCount, panelCount } = countDashboardStats(dashboard);
        this.bootStats.groupCount = groupCount;
        this.bootStats.panelCount = panelCount;

        const next = deepCloneStructured(dashboard);
        this.currentDashboard = next;
        this.finishBoot();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply dashboard json';
        this.failBoot(message);
        throw error;
      }
    },

    /**
     * 保存 Dashboard
     */
    async saveDashboard() {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      this.isSaving = true;
      this.lastError = null;
      try {
        const api = getPiniaApiClient(this.$pinia);
        await api.dashboard.saveDashboard(this.currentDashboard);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save dashboard';
        this.lastError = message;
        console.error('Failed to save dashboard:', error);
        throw error;
      } finally {
        this.isSaving = false;
      }
    },

    /**
     * 设置当前可编辑的面板组
     *
     * 约束：
     * - “全部面板”视图只读：强制清空
     * - boot 阶段禁止编辑：强制清空
     */
    setEditingGroup(groupId: ID | null) {
      if (this.isBooting) return;
      if (this.viewMode === 'allPanels') {
        this.editingGroupId = null;
        return;
      }
      this.editingGroupId = groupId;
    },

    /**
     * 切换某个面板组的编辑状态
     * - 若当前已在编辑该组：退出编辑
     * - 否则：进入编辑（并退出其他组的编辑）
     */
    toggleGroupEditing(groupId: ID) {
      if (this.isBooting) return;
      if (this.viewMode === 'allPanels') return;
      const key = String(groupId);
      if (this.editingGroupId != null && String(this.editingGroupId) === key) {
        this.editingGroupId = null;
        return;
      }
      this.editingGroupId = groupId;
    },

    /**
     * 切换视图模式（分组视图 <-> 全部面板视图）
     *
     * 说明：
     * - 全部面板视图只读：进入时自动退出编辑模式
     */
    setViewMode(mode: DashboardViewMode) {
      if (this.isBooting) return;
      const next: DashboardViewMode = mode === 'allPanels' ? 'allPanels' : 'grouped';
      this.viewMode = next;
      if (next === 'allPanels') {
        this.editingGroupId = null;
      }
    },

    togglePanelsView() {
      this.setViewMode(this.viewMode === 'allPanels' ? 'grouped' : 'allPanels');
    },

    /**
     * 添加面板组
     */
    addPanelGroup(group: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      const newGroup: PanelGroup = {
        id: createPrefixedId('pg'),
        title: group.title || '新面板组',
        description: group.description,
        isCollapsed: true,
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
      if (this.isBooting) return;

      const index = this.currentDashboard.panelGroups.findIndex((g) => g.id === id);
      if (index !== -1) {
        const currentGroup = this.currentDashboard.panelGroups[index];
        if (currentGroup) {
          this.currentDashboard.panelGroups[index] = {
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
    },

    /**
     * 删除面板组
     */
    deletePanelGroup(id: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      this.currentDashboard.panelGroups = this.currentDashboard.panelGroups.filter((g) => g.id !== id);
    },

    /**
     * 移动面板组
     */
    movePanelGroup(fromIndex: number, toIndex: number) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

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
     * 批量重排面板组（用于拖拽排序）
     *
     * 说明：
     * - nextOrder 传入的是“面板组 id 的顺序数组”
     * - 会同时更新 currentDashboard.panelGroups 的数组顺序 + 每个 group.order
     * - 若 nextOrder 缺失/包含未知 id：会忽略未知项，并把缺失的组按原顺序追加到末尾（保证稳定）
     */
    reorderPanelGroups(nextOrder: ID[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      const groups = this.currentDashboard.panelGroups ?? [];
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
      // append missing groups (keep previous relative order)
      for (const g of groups) {
        const key = String(g.id);
        if (used.has(key)) continue;
        used.add(key);
        next.push(g);
      }

      next.forEach((g, index) => {
        g.order = index;
      });
      this.currentDashboard.panelGroups = next;
    },

    /**
     * 更新面板组布局
     */
    updatePanelGroupLayout(groupId: ID, layout: PanelLayout[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (group) {
        group.layout = layout;
      }
    },

    /**
     * 分页编辑模式：只更新当前页的 layout items（按 i 合并回全量 layout）
     *
     * 注意：
     * - 不会删除/新增 layout 项，仅更新已存在的项
     * - 仅作用于当前 group
     */
    patchPanelGroupLayoutItems(groupId: ID, patch: PanelLayout[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (!group || !Array.isArray(group.layout) || group.layout.length === 0) return;

      const byId = new Map<string, PanelLayout>();
      for (const it of group.layout) byId.set(String(it.i), it);

      for (const next of patch) {
        const existing = byId.get(String(next.i));
        if (!existing) continue;
        Object.assign(existing, next);
      }
    },

    /**
     * 添加面板
     */
    addPanel(groupId: ID, panel: Panel) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;

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
      if (this.isBooting) return;

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
