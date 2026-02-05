/**
 * Dashboard 状态管理
 */

import { defineStore } from '@grafana-fast/store';
import { markRaw, toRaw } from 'vue';
import type { DashboardContent, DashboardId, PanelGroup, Panel, ID, DashboardVariable, VariableOption } from '@grafana-fast/types';
import { deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { AUTO_SYNC_DEBOUNCE_MS, BIG_DASHBOARD_JSON_BYTES_THRESHOLD, BIG_DASHBOARD_PANEL_THRESHOLD } from './dashboard/constants';
import {
  addPanel,
  addPanelGroup,
  deletePanel,
  deletePanelGroup,
  duplicatePanel,
  movePanelGroup,
  patchPanelGroupLayoutItems,
  reorderPanelGroups,
  setEditingGroup,
  setViewMode,
  setViewPanel,
  toggleGroupEditing,
  togglePanelView,
  togglePanelsView,
  updatePanel,
  updatePanelGroup,
  updatePanelGroupLayout,
} from './dashboard/mutations';
import {
  countDashboardStats,
  normalizeNonNegativeInt,
  normalizeVariableCurrent,
  safeUtf8Bytes,
  sanitizeDashboardContent,
  yieldToPaint,
} from './dashboard/helpers';
import type { BootStage, DashboardState } from './dashboard/types';
import { useTimeRangeStore } from './timeRange';
import { useVariablesStore } from './variables';

// NOTE: constants + helpers extracted to ./dashboard/* to keep this store file focused on mutations/state.

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    dashboardId: null,
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
      // currentDashboard 可能被 markRaw（避免大对象深度响应式开销），
      // 因此这里显式依赖 revision，保证任何内容变更都能触发 UI 更新。
      void this.dashboardContentRevision;
      const groups = this.currentDashboard?.panelGroups ?? [];
      // 返回一个浅拷贝，确保作为 props 传递时能触发子组件更新（避免引用不变导致的 patch 跳过）。
      return Array.isArray(groups) ? groups.slice() : [];
    },

    /**
     * 根据 ID 获取面板组
     */
    getPanelGroupById: (state) => (id: ID) => {
      // 依赖 revision：确保在 markRaw dashboard 下，深层变更也能驱动响应式更新。
      void state.dashboardContentRevision;
      return state.currentDashboard?.panelGroups.find((g) => g.id === id);
    },

    /**
     * 根据 ID 获取面板
     */
    getPanelById: (state) => (groupId: ID, panelId: ID) => {
      // 依赖 revision：确保在 markRaw dashboard 下，深层变更也能驱动响应式更新。
      void state.dashboardContentRevision;
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
      // 依赖 revision：面板/布局变更后，提示信息也能跟随更新。
      void this.dashboardContentRevision;
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
    /**
     * 将 Dashboard JSON 的“默认/持久化字段”同步到运行时 store（timeRange/variables）
     *
     * 说明：
     * - timeRange/refreshInterval/variables 是“运行时需要全局读取”的字段，不应散落在多个地方各自维护
     * - 这里把它们统一落在 store 中：
     *   - timeRangeStore：timeRange + refreshInterval（并负责 auto refresh timer）
     *   - variablesStore：values/options（并负责 options 解析）
     */
    _syncRuntimeStoresFromDashboard(dashboard: DashboardContent) {
      try {
        const timeRangeStore = useTimeRangeStore(this.$pinia);
        // 深拷贝：避免外部 dashboard 引用污染运行时 store
        timeRangeStore.setTimeRange(deepCloneStructured(dashboard.timeRange));
        timeRangeStore.setRefreshInterval(normalizeNonNegativeInt(dashboard.refreshInterval, 0));
      } catch {
        // ignore: runtime sync should never break dashboard flow
      }

      try {
        const variablesStore = useVariablesStore(this.$pinia);
        variablesStore.initializeFromDashboard(dashboard.variables);
        // 解析 options 属于增强能力：异步失败不应阻断主流程
        void variablesStore.resolveOptions();
      } catch {
        // ignore
      }
    },

    /**
     * 构造一个“可持久化/可导出”的 Dashboard 快照：
     * - 合并运行时的 timeRange/refreshInterval（来自 timeRangeStore）
     * - 合并运行时的变量 current/options（来自 variablesStore）
     *
     * 重要：
     * - 该快照用于 save/export/json-view 等场景，避免 Dashboard JSON 与运行时 state 不一致
     */
    _buildPersistableDashboardSnapshot(): DashboardContent {
      if (!this.currentDashboard) throw new Error('No dashboard');
      const dash = sanitizeDashboardContent(toRaw(this.currentDashboard) as DashboardContent);

      try {
        const timeRangeStore = useTimeRangeStore(this.$pinia);
        dash.timeRange = deepCloneStructured(toRaw(timeRangeStore.timeRange));
        dash.refreshInterval = normalizeNonNegativeInt(toRaw(timeRangeStore.refreshInterval), dash.refreshInterval ?? 0);
      } catch {
        // ignore: use dashboard's own fields as fallback
      }

      try {
        const variablesStore = useVariablesStore(this.$pinia);
        const values = (variablesStore.state?.values ?? {}) as Record<string, unknown>;
        const options = (variablesStore.state?.options ?? {}) as Record<string, VariableOption[]>;
        if (Array.isArray(dash.variables)) {
          dash.variables = dash.variables.map((v) => {
            const name = String(v?.name ?? '').trim();
            if (!name) return v;
            const next: DashboardVariable = { ...v };
            if (name in values) next.current = normalizeVariableCurrent(v, values[name]);
            if (name in options) next.options = deepCloneStructured(options[name] ?? []);
            return next;
          });
        }
      } catch {
        // ignore
      }

      return dash;
    },

    /**
     * 给 UI/SDK 暴露的导出快照（稳定入口）
     */
    getPersistableDashboardSnapshot(): DashboardContent | null {
      if (!this.currentDashboard) return null;
      try {
        return this._buildPersistableDashboardSnapshot();
      } catch {
        return deepCloneStructured(toRaw(this.currentDashboard));
      }
    },

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
    replaceDashboard(dashboard: DashboardContent, options?: { markAsSynced?: boolean }) {
      // 替换时停止自动同步，避免旧 debounce 定时器在新数据上触发
      this.cancelPendingSync();

      const next = sanitizeDashboardContent(dashboard);
      // 大对象：使用 markRaw 避免深度响应式转换的隐形成本（大盘更明显）
      this.currentDashboard = markRaw(next);

      // 同步运行时 store（timeRange/variables）
      this._syncRuntimeStoresFromDashboard(next);

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
        // 注意：syncedDashboard 代表“已确认态”，应使用可持久化快照（保证与运行时一致）
        this.syncedDashboard = markRaw(deepCloneStructured(this.getPersistableDashboardSnapshot() ?? next));
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
      this.syncedDashboard = markRaw(deepCloneStructured(toRaw(this.currentDashboard)));
      this.hasUnsyncedChanges = false;
    },

    resetToSynced() {
      if (!this.syncedDashboard) return;
      // 同上：先 toRaw 再 clone，避免 structuredClone 克隆 Proxy 报错
      const next = deepCloneStructured(toRaw(this.syncedDashboard));
      this.currentDashboard = markRaw(next);
      // 回滚后同步运行时 store，避免 timeRange/variables 仍停留在“回滚前”的值
      this._syncRuntimeStoresFromDashboard(next);
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
      const dashboardId = this.dashboardId;
      if (!dashboardId) {
        // 没有绑定 dashboardId（资源标识）时无法持久化到远端。
        // - 自动同步：静默 no-op，避免后台不断重试/刷错误
        // - 手动保存：明确抛错，提示宿主需要先 bind/load dashboardId
        if (mode === 'manual') {
          throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');
        }
        return;
      }

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
      const payload = this._buildPersistableDashboardSnapshot();
      try {
        const api = getPiniaApiClient(this.$pinia);
        await api.dashboard.saveDashboard(dashboardId, payload);

        // 忽略过期完成：例如请求进行中发生了 load/import/replace，不能用老结果覆盖状态。
        if (this._syncInFlightSeq !== token) return;

        this.syncedDashboard = markRaw(deepCloneStructured(payload));
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
    async loadDashboard(dashboardId: DashboardId) {
      // 绑定资源标识并清空旧内容，避免出现“dashboardId 与内容不一致导致保存错资源”的风险。
      this.dashboardId = dashboardId;
      this.currentDashboard = null;
      this.syncedDashboard = null;
      this.hasUnsyncedChanges = false;

      this.beginBoot('remote', 'fetching');
      try {
        await yieldToPaint();
        const api = getPiniaApiClient(this.$pinia);
        const dashboard = await api.dashboard.loadDashboard(dashboardId);
        this.bootStage = 'initializing';
        await yieldToPaint();

        const { groupCount, panelCount } = countDashboardStats(dashboard);
        this.bootStats.groupCount = groupCount;
        this.bootStats.panelCount = panelCount;

        // 按当前策略：不做历史 schema 兼容/迁移；API 返回什么就用什么（外部应保证是当前结构）。
        // 大 JSON 下用 structuredClone 降低 stringify/parse 的主线程压力。
        const next = sanitizeDashboardContent(dashboard);
        this.currentDashboard = markRaw(next);
        this._syncRuntimeStoresFromDashboard(next);
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
    async applyDashboardFromJson(dashboard: DashboardContent, rawJsonText?: string) {
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

        const next = sanitizeDashboardContent(dashboard);
        this.currentDashboard = markRaw(next);
        this._syncRuntimeStoresFromDashboard(next);
        // Import/apply 属于“用户主动修改”：但此时还未被远端确认，不能直接覆盖 syncedDashboard，
        // 否则后续保存失败将无法回滚到远端快照。
        //
        // 约定：
        // - 若已存在 syncedDashboard（通常来自 loadDashboard）：保持不变，等待 save/sync 成功后再更新
        // - 若不存在 syncedDashboard：退化为“以当前为已确认态”，避免后续回滚无源
        if (!this.syncedDashboard) {
          this.syncedDashboard = markRaw(deepCloneStructured(next));
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

    // ---- Dashboard mutations (group/panel/view) ----
    setEditingGroup,
    toggleGroupEditing,
    setViewMode,
    togglePanelsView,
    addPanelGroup,
    updatePanelGroup,
    deletePanelGroup,
    movePanelGroup,
    reorderPanelGroups,
    updatePanelGroupLayout,
    patchPanelGroupLayoutItems,
    addPanel,
    updatePanel,
    deletePanel,
    duplicatePanel,
    setViewPanel,
    togglePanelView,
  },
});
