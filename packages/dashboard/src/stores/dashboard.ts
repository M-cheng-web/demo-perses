/**
 * Dashboard 状态管理
 */

import { defineStore } from '@grafana-fast/store';
import { toRaw } from 'vue';
import type { Dashboard, PanelGroup, Panel, PanelLayout, ID } from '@grafana-fast/types';
import { createPrefixedId, deepClone, deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';

type BootStage = 'idle' | 'fetching' | 'parsing' | 'initializing' | 'ready' | 'error';
type DashboardViewMode = 'grouped' | 'allPanels';

interface DashboardState {
  /** 当前 Dashboard */
  currentDashboard: Dashboard | null;
  /**
   * 全局只读模式（宿主能力开关）
   *
   * 语义：
   * - true：禁止任何会修改 Dashboard JSON 的操作（UI 会禁用入口，store 层也会兜底 guard）
   * - false：允许编辑（仍受 boot/viewMode/editingGroupId 等约束）
   */
  isReadOnly: boolean;
  /**
   * 最近一次“已被远端确认成功保存”的 Dashboard（用于乐观更新失败回滚）
   *
   * 语义：
   * - currentDashboard：页面当前正在渲染/编辑的“乐观态”
   * - syncedDashboard：最后一次与远端一致的“已确认态”
   */
  syncedDashboard: Dashboard | null;
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
  /** 是否正在同步（乐观更新：后台自动保存） */
  isSyncing: boolean;
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

  /** 是否存在“尚未同步到远端”的变更（仅用于 UI/调试提示） */
  hasUnsyncedChanges: boolean;
  /**
   * Dashboard 内容变更代际（单调递增）
   *
   * 说明：
   * - 用于 SDK/外部集成场景：无需 deep watch 大对象即可感知“dashboard JSON 有变化”
   * - 任何会改变 currentDashboard 内容的操作都应 bump
   */
  dashboardContentRevision: number;

  // ---- Internal sync state (per store instance) ----
  _syncTimerId: number | null;
  _syncQueued: boolean;
  _syncSeq: number;
  _syncInFlightSeq: number | null;
}

const BIG_DASHBOARD_PANEL_THRESHOLD = 200;
const BIG_DASHBOARD_JSON_BYTES_THRESHOLD = 2 * 1024 * 1024; // 2MB
const AUTO_SYNC_DEBOUNCE_MS = 200;

function yieldToPaint(): Promise<void> {
  // 用 setTimeout(0) 让浏览器有机会先渲染 loading mask，避免“先卡住再出现遮罩”
  return new Promise((r) => window.setTimeout(r, 0));
}

function safeUtf8Bytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    // 兜底：近似值（UTF-16 code units）
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
    isReadOnly: false,
    syncedDashboard: null,
    editingGroupId: null,
    viewMode: 'grouped',
    isSaving: false,
    isSyncing: false,
    lastError: null,
    viewPanelId: null,
    isBooting: false,
    bootStage: 'idle',
    bootStats: { startedAt: null, groupCount: null, panelCount: null, jsonBytes: null, source: null },
    hasUnsyncedChanges: false,
    dashboardContentRevision: 0,
    _syncTimerId: null,
    _syncQueued: false,
    _syncSeq: 0,
    _syncInFlightSeq: null,
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
    isGroupEditing:
      (state) =>
      (groupId: ID): boolean => {
        if (state.isBooting) return false;
        if (state.isReadOnly) return false;
        if (state.viewMode === 'allPanels') return false;
        return state.editingGroupId != null && String(state.editingGroupId) === String(groupId);
      },
  },

  actions: {
    _bumpDashboardContentRevision() {
      const next = (this.dashboardContentRevision ?? 0) + 1;
      this.dashboardContentRevision = next <= Number.MAX_SAFE_INTEGER ? next : 0;
    },

    /**
     * 直接替换当前 Dashboard（命令式入口，供 SDK/压测/回放等使用）
     *
     * 设计：
     * - 不走 boot 阶段遮罩（避免“宿主只是替换数据，但 UI 一直 lock”的困惑）
     * - 会重置可能指向旧对象的 UI 状态（editing/viewPanel）
     * - 默认认为这是“已确认态”（markAsSynced=true），避免后续回滚无源
     */
    replaceDashboard(dashboard: Dashboard, options?: { markAsSynced?: boolean }) {
      // 替换时停止自动同步，避免旧 debounce 定时器在新数据上触发
      this.cancelPendingSync();

      const next = deepCloneStructured(dashboard);
      this.currentDashboard = next;

      // 重置可能指向旧对象的 UI 状态（避免引用悬挂/状态错乱）。
      this.editingGroupId = null;
      this.viewPanelId = null;
      this.viewMode = 'grouped';

      // 保持 store 处于一致的“ready”态（不进入 boot 遮罩流程）。
      this.isBooting = false;
      this.bootStage = 'ready';
      this.lastError = null;

      // 更新统计信息（用于 UI 提示，例如“大盘加载更慢”等）。
      const { groupCount, panelCount } = countDashboardStats(next);
      this.bootStats.groupCount = groupCount;
      this.bootStats.panelCount = panelCount;
      this.bootStats.source = this.bootStats.source ?? 'import';

      const markAsSynced = options?.markAsSynced !== false;
      if (markAsSynced) {
        this.syncedDashboard = deepCloneStructured(next);
        this.hasUnsyncedChanges = false;
      } else {
        this.hasUnsyncedChanges = true;
      }

      this._bumpDashboardContentRevision();
    },

    setReadOnly(readOnly: boolean) {
      const next = !!readOnly;
      this.isReadOnly = next;
      if (next) {
        // 进入只读：退出编辑态 + 停止后台自动同步（避免残留副作用）
        this.editingGroupId = null;
        this.cancelPendingSync();
      }
    },

    cancelPendingSync() {
      if (this._syncTimerId != null) {
        window.clearTimeout(this._syncTimerId);
        this._syncTimerId = null;
      }
      this._syncQueued = false;
      // 使任何 in-flight 的完成回调失效（避免老请求回写/干扰）。
      this._syncSeq++;
      this._syncInFlightSeq = null;
      this.isSyncing = false;
    },

    markSyncedFromCurrent() {
      if (!this.currentDashboard) {
        this.syncedDashboard = null;
        this.hasUnsyncedChanges = false;
        return;
      }
      // Pinia/Vue state 读取到的是 reactive Proxy；structuredClone 无法克隆 Proxy。
      // 这里先 toRaw 再 clone，避免 DataCloneError。
      this.syncedDashboard = deepCloneStructured(toRaw(this.currentDashboard));
      this.hasUnsyncedChanges = false;
    },

    resetToSynced() {
      if (!this.syncedDashboard) return;
      // 同上：先 toRaw 再 clone，避免 structuredClone 克隆 Proxy 报错
      this.currentDashboard = deepCloneStructured(toRaw(this.syncedDashboard));
      // 回滚后，清理可能指向“已失效对象”的 UI 状态，避免残留交互异常
      this.editingGroupId = null;
      this.viewPanelId = null;
      this.hasUnsyncedChanges = false;
      this._bumpDashboardContentRevision();
    },

    requestAutoSync() {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

      this._bumpDashboardContentRevision();
      this.hasUnsyncedChanges = true;

      if (this._syncTimerId != null) {
        window.clearTimeout(this._syncTimerId);
        this._syncTimerId = null;
      }
      this._syncTimerId = window.setTimeout(() => {
        this._syncTimerId = null;
        void this.syncDashboard({ mode: 'auto' });
      }, AUTO_SYNC_DEBOUNCE_MS);
    },

    async waitForSyncIdle(timeoutMs = 8_000) {
      const startedAt = Date.now();
      while (this.isSyncing) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error('Sync timeout');
        }
        await new Promise<void>((r) => window.setTimeout(r, 50));
      }
    },

    async syncDashboard(options?: { mode?: 'auto' | 'manual' }) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) {
        // 自动同步：静默 no-op；手动保存：明确抛错提示。
        if (options?.mode === 'manual') throw new Error('Dashboard is read-only');
        return;
      }

      const mode = options?.mode ?? 'auto';

      // 手动保存：若后台正在 auto-sync，先等待其结束，再保存最新状态。
      if (mode === 'manual' && this.isSyncing) {
        await this.waitForSyncIdle();
      }

      // 自动同步：如果正在同步，标记 queued 后返回（后续会再跑一轮）。
      if (mode === 'auto' && this.isSyncing) {
        this._syncQueued = true;
        return;
      }

      if (this.isSyncing) {
        // 极少数情况：重入/边界条件（守护一下）。
        this._syncQueued = true;
        return;
      }

      const token = ++this._syncSeq;
      this._syncInFlightSeq = token;
      this.isSyncing = true;
      if (mode === 'manual') this.isSaving = true;
      this.lastError = null;

      // 先做一次快照：保证本次持久化写入的是一个稳定 JSON（即使 UI 继续变化）。
      const payload = deepCloneStructured(toRaw(this.currentDashboard));
      try {
        const api = getPiniaApiClient(this.$pinia);
        await api.dashboard.saveDashboard(payload);

        // 忽略过期完成：例如请求进行中发生了 load/import/replace，不能用老结果覆盖状态。
        if (this._syncInFlightSeq !== token) return;

        this.syncedDashboard = deepCloneStructured(payload);
        this.hasUnsyncedChanges = false;
      } catch (error) {
        if (this._syncInFlightSeq !== token) return;
        const message = error instanceof Error ? error.message : 'Failed to save dashboard';
        this.lastError = message;

        // 乐观更新失败：回滚到“已确认态”，保证本地与远端一致
        if (this.syncedDashboard) {
          this.resetToSynced();
        }

        if (mode === 'manual') throw error;
      } finally {
        if (this._syncInFlightSeq !== token) return;
        this._syncInFlightSeq = null;
        this.isSyncing = false;
        if (mode === 'manual') this.isSaving = false;

        if (this._syncQueued) {
          this._syncQueued = false;
          // 自动同步：继续尝试保存最新状态（不向上抛错）。
          void this.syncDashboard({ mode: 'auto' });
        }
      }
    },

    beginBoot(source: 'remote' | 'import', stage: BootStage) {
      // boot 过程中不应继续自动同步（避免“老请求回写/回滚”干扰初始化）
      this.cancelPendingSync();
      this.isBooting = true;
      this.bootStage = stage;
      this.lastError = null;
      this.viewPanelId = null;
      // boot 中禁止编辑：锁住交互，避免“半初始化状态”产生不一致
      this.editingGroupId = null;
      this.viewMode = 'grouped';
      this.hasUnsyncedChanges = false;
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
        this.markSyncedFromCurrent();
        this._bumpDashboardContentRevision();
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
      if (this.isReadOnly) throw new Error('Dashboard is read-only');
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
        // Import/apply 属于“用户主动修改”：但此时还未被远端确认，不能直接覆盖 syncedDashboard，
        // 否则后续保存失败将无法回滚到远端快照。
        //
        // 约定：
        // - 若已存在 syncedDashboard（通常来自 loadDashboard）：保持不变，等待 save/sync 成功后再更新
        // - 若不存在 syncedDashboard：退化为“以当前为已确认态”，避免后续回滚无源
        if (!this.syncedDashboard) {
          this.syncedDashboard = deepCloneStructured(next);
          this.hasUnsyncedChanges = false;
        } else {
          this.hasUnsyncedChanges = true;
        }
        this.finishBoot();
        this._bumpDashboardContentRevision();
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
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      try {
        // 手动保存：清空 debounce 计时器并立即持久化。
        if (this._syncTimerId != null) {
          window.clearTimeout(this._syncTimerId);
          this._syncTimerId = null;
        }
        await this.syncDashboard({ mode: 'manual' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save dashboard';
        this.lastError = message;
        console.error('Failed to save dashboard:', error);
        throw error;
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
      if (this.isReadOnly) {
        this.editingGroupId = null;
        return;
      }
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
      if (this.isReadOnly) return;
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
      if (this.isReadOnly) return;

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
      this.requestAutoSync();
    },

    /**
     * 更新面板组
     */
    updatePanelGroup(id: ID, updates: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

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
      this.requestAutoSync();
    },

    /**
     * 删除面板组
     */
    deletePanelGroup(id: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

      this.currentDashboard.panelGroups = this.currentDashboard.panelGroups.filter((g) => g.id !== id);
      this.requestAutoSync();
    },

    /**
     * 移动面板组
     */
    movePanelGroup(fromIndex: number, toIndex: number) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

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
      this.requestAutoSync();
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
      if (this.isReadOnly) return;

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
      this.currentDashboard.panelGroups = next;
      this.requestAutoSync();
    },

    /**
     * 更新面板组布局
     */
    updatePanelGroupLayout(groupId: ID, layout: PanelLayout[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (group) {
        group.layout = layout;
      }
      this.requestAutoSync();
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
      if (this.isReadOnly) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (!group || !Array.isArray(group.layout) || group.layout.length === 0) return;

      const byId = new Map<string, PanelLayout>();
      for (const it of group.layout) byId.set(String(it.i), it);

      for (const next of patch) {
        const existing = byId.get(String(next.i));
        if (!existing) continue;
        Object.assign(existing, next);
      }
      this.requestAutoSync();
    },

    /**
     * 添加面板
     */
    addPanel(groupId: ID, panel: Panel) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

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
      this.requestAutoSync();
    },

    /**
     * 更新面板
     */
    updatePanel(groupId: ID, panelId: ID, updates: Partial<Panel>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

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
      this.requestAutoSync();
    },

    /**
     * 删除面板
     */
    deletePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

      const group = this.currentDashboard.panelGroups.find((g) => g.id === groupId);
      if (!group) return;

      // 删除面板
      group.panels = group.panels.filter((p) => p.id !== panelId);

      // 删除布局
      group.layout = group.layout.filter((l) => l.i !== panelId);
      this.requestAutoSync();
    },

    /**
     * 复制面板
     */
    duplicatePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;

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
