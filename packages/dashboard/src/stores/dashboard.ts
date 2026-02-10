/**
 * Dashboard 状态管理
 */

import { defineStore } from '@grafana-fast/store';
import { markRaw, toRaw } from 'vue';
import type { DashboardContent, DashboardId, PanelGroup, Panel, PanelLayout, ID, DashboardVariable, VariableOption } from '@grafana-fast/types';
import { createPrefixedId, deepCloneStructured } from '/#/utils';
import { getPiniaApiClient } from '/#/runtime/piniaAttachments';
import { BIG_DASHBOARD_JSON_BYTES_THRESHOLD, BIG_DASHBOARD_PANEL_THRESHOLD } from './dashboard/constants';
import {
  addPanel as addPanelLocal,
  addPanelGroup as addPanelGroupLocal,
  deletePanel as deletePanelLocal,
  deletePanelGroup as deletePanelGroupLocal,
  movePanelGroup as movePanelGroupLocal,
  patchPanelGroupLayoutItems as patchPanelGroupLayoutItemsLocal,
  reorderPanelGroups as reorderPanelGroupsLocal,
  setEditingGroup,
  setViewMode,
  setViewPanel,
  toggleGroupEditing,
  togglePanelView,
  togglePanelsView,
  updatePanel as updatePanelLocal,
  updatePanelGroup as updatePanelGroupLocal,
  updatePanelGroupLayout as updatePanelGroupLayoutLocal,
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
    uiPageJumpRequest: null,
    _uiPageJumpNonce: 0,
    _layoutPatchInFlightByGroupId: {},
    _layoutPatchQueuedItemsByGroupId: {},
    _remoteOpSeq: 0,
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

      // 同时使“局部持久化”（layout patch / panel CRUD / group CRUD）的旧请求回写失效
      this._remoteOpSeq++;
      this._layoutPatchInFlightByGroupId = {};
      this._layoutPatchQueuedItemsByGroupId = {};
      this.uiPageJumpRequest = null;
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

    /**
     * 标记 Dashboard 内容已变更（用于触发 UI 更新 + 记录“未确认态”）
     *
     * 说明：
     * - currentDashboard 大对象使用 markRaw，深层字段变更不会自动触发响应式更新
     * - 任何会修改 dashboard JSON 的操作都应调用该方法 bump revision
     * - 产品化编辑流：变更通常会走“局部接口”持久化；失败则回滚到 syncedDashboard
     */
    markDashboardDirty(options?: { hasUnsyncedChanges?: boolean }) {
      if (this.isBooting) return;
      this._bumpDashboardContentRevision();
      if (options?.hasUnsyncedChanges === false) return;
      this.hasUnsyncedChanges = true;
    },

    requestAutoSync() {
      // NOTE: 保留该方法作为兼容入口，但不再做“全量 JSON auto-save”。
      // 新版本编辑流要求：
      // - 首次进入：后端返回完整 dashboard JSON
      // - 之后：仅通过局部接口（layout patch / panel CRUD / group CRUD）持久化变更
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;
      this.markDashboardDirty();
    },

    requestPanelGroupPageJump(groupId: ID, page: number) {
      const g = String(groupId ?? '');
      if (!g) return;
      const p = Number(page);
      const nextPage = Number.isFinite(p) ? Math.max(1, Math.floor(p)) : 1;
      this.uiPageJumpRequest = { groupId, page: nextPage, nonce: ++this._uiPageJumpNonce };
    },

    consumePanelGroupPageJump(nonce: number) {
      const current = this.uiPageJumpRequest;
      if (!current) return;
      if (Number(current.nonce) !== Number(nonce)) return;
      this.uiPageJumpRequest = null;
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

    // ---------------------------
    // 局部持久化（产品化编辑流）
    // ---------------------------
    _getGroupFromDashboard(dashboard: DashboardContent | null, groupId: ID): PanelGroup | null {
      if (!dashboard) return null;
      const groups = dashboard.panelGroups ?? [];
      const key = String(groupId);
      return groups.find((g) => String(g.id) === key) ?? null;
    },

    _upsertLayoutItemsOnDashboard(dashboard: DashboardContent | null, groupId: ID, items: PanelLayout[]) {
      const group = this._getGroupFromDashboard(dashboard, groupId);
      if (!group) return;
      group.layout ??= [];
      const byId = new Map<string, PanelLayout>();
      for (const it of group.layout) byId.set(String(it.i), it);
      for (const next of items) {
        const key = String(next.i);
        const existing = byId.get(key);
        if (existing) {
          Object.assign(existing, next);
          continue;
        }
        const created: PanelLayout = { ...(next as any) };
        group.layout.push(created);
        byId.set(key, created);
      }
    },

    _removePanelFromDashboard(dashboard: DashboardContent | null, groupId: ID, panelId: ID) {
      const group = this._getGroupFromDashboard(dashboard, groupId);
      if (!group) return;
      const pid = String(panelId);
      group.panels = (group.panels ?? []).filter((p) => String(p.id) !== pid);
      group.layout = (group.layout ?? []).filter((it) => String(it.i) !== pid);
    },

    _upsertPanelOnDashboard(dashboard: DashboardContent | null, groupId: ID, panel: Panel) {
      const group = this._getGroupFromDashboard(dashboard, groupId);
      if (!group) return;
      group.panels ??= [];
      const safe = deepCloneStructured(panel) as Panel;
      const pid = String(safe.id);
      const idx = group.panels.findIndex((p) => String(p.id) === pid);
      if (idx >= 0) {
        group.panels[idx] = safe;
        return;
      }
      group.panels.push(safe);
    },

    _replaceTempPanelIdOnCurrent(groupId: ID, tempId: ID, panel: Panel, layout?: PanelLayout) {
      if (!this.currentDashboard) return;
      const group = this._getGroupFromDashboard(this.currentDashboard, groupId);
      if (!group) return;

      group.panels ??= [];
      group.layout ??= [];

      const tmp = String(tempId);
      const nextId = String(panel.id);

      // Replace panel entry (keep array order stable)
      const panelIdx = group.panels.findIndex((p) => String(p.id) === tmp);
      if (panelIdx >= 0) {
        group.panels[panelIdx] = panel;
      } else {
        group.panels.push(panel);
      }

      // Replace layout entry id + apply backend layout if provided
      const layoutIdx = group.layout.findIndex((it) => String(it.i) === tmp);
      if (layoutIdx >= 0) {
        const existing = group.layout[layoutIdx]!;
        if (layout) {
          Object.assign(existing, layout);
          existing.i = nextId;
        } else {
          existing.i = nextId;
        }
      } else if (layout) {
        group.layout.push(layout);
      } else {
        // Fallback: keep a minimal layout entry so the new panel is renderable
        const maxY = Math.max(...(group.layout ?? []).map((l) => Number(l.y ?? 0) + Number(l.h ?? 0)), 0);
        group.layout.push({ i: nextId, x: 0, y: maxY, w: 24, h: 8, minW: 6, minH: 4 });
      }

      // Ensure no leftover temp layout entries
      group.layout = (group.layout ?? []).filter((it) => String(it.i) !== tmp);

      this.markDashboardDirty({ hasUnsyncedChanges: false });
    },

    _getPanelGroupPageCount(groupId: ID, pageSize = 20): number {
      const group = this._getGroupFromDashboard(this.currentDashboard, groupId);
      const total = group?.panels?.length ?? 0;
      const size = Math.max(1, Math.floor(Number(pageSize) || 20));
      return Math.max(1, Math.ceil(total / size));
    },

    _queuePanelGroupLayoutPatch(groupId: ID, items: Array<{ i: ID; x: number; y: number; w: number; h: number }>) {
      const key = String(groupId ?? '');
      if (!key) return;
      const safeItems = (Array.isArray(items) ? items : [])
        .slice(0, 20)
        .map((it) => ({ i: it.i, x: Number(it.x ?? 0), y: Number(it.y ?? 0), w: Number(it.w ?? 0), h: Number(it.h ?? 0) }));
      this._layoutPatchQueuedItemsByGroupId[key] = safeItems;
      void this._flushPanelGroupLayoutPatchQueue(groupId, this._remoteOpSeq);
    },

    async _flushPanelGroupLayoutPatchQueue(groupId: ID, opSeq: number) {
      const key = String(groupId ?? '');
      if (!key) return;
      if (this._layoutPatchInFlightByGroupId[key]) return;

      this._layoutPatchInFlightByGroupId[key] = true;
      try {
        while (opSeq === this._remoteOpSeq) {
          const queued = this._layoutPatchQueuedItemsByGroupId[key];
          if (!queued || queued.length === 0) break;
          this._layoutPatchQueuedItemsByGroupId[key] = null;

          const dashboardId = this.dashboardId;
          if (!dashboardId) throw new Error('Missing dashboardId');

          const api = getPiniaApiClient(this.$pinia);
          const patchFn = api.dashboard.patchPanelGroupLayoutPage;
          if (!patchFn) throw new Error('DashboardService.patchPanelGroupLayoutPage is not implemented');

          const res = await patchFn({ dashboardId, groupId, items: queued });
          if (opSeq !== this._remoteOpSeq) return;

          // 后端可选返回最终 layout（例如 compact 后的结果）；若返回，则回写 current+synced
          const serverItems = Array.isArray(res?.items) && res.items.length > 0 ? res.items : null;
          if (serverItems) {
            // 回写当前态（避免“后端调整过但前端还用旧布局”）
            patchPanelGroupLayoutItemsLocal.call(this, groupId, serverItems);
          }

          const applyItems: PanelLayout[] = serverItems ?? queued.map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h } as PanelLayout));
          this._upsertLayoutItemsOnDashboard(this.syncedDashboard, groupId, applyItems);
          this.hasUnsyncedChanges = false;
          this.lastError = null;
        }
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to patch layout';
        this.lastError = `布局更新失败，已回滚：${msg}`;
        // 清空队列，避免回滚后继续发送旧 patch
        this._layoutPatchQueuedItemsByGroupId[key] = null;
        this.resetToSynced();
      } finally {
        if (opSeq !== this._remoteOpSeq) return;
        this._layoutPatchInFlightByGroupId[key] = false;
      }
    },

    /**
     * 分页布局 patch（产品化要求：一次提交当前页全部 items，最多 20 条）
     *
     * 说明：
     * - 该 action 由 GridLayout 提交（debounced），已包含当前页全部面板的布局
     * - 本地先乐观更新，再调用后端局部接口
     * - 若接口失败：回滚到 syncedDashboard
     */
    patchPanelGroupLayoutItems(groupId: ID, patch: PanelLayout[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) return;
      if (!Array.isArray(patch) || patch.length === 0) return;

      patchPanelGroupLayoutItemsLocal.call(this, groupId, patch);
      const items = patch.slice(0, 20).map((it) => ({
        i: it.i,
        x: Number(it.x ?? 0),
        y: Number(it.y ?? 0),
        w: Number(it.w ?? 0),
        h: Number(it.h ?? 0),
      }));
      this._queuePanelGroupLayoutPatch(groupId, items);
    },

    /**
     * 创建面板（乐观更新 + 后端返回最终 panel/id）
     */
    async addPanel(groupId: ID, panel: Panel) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      // optimistic insert with a temp id (backend generates the final id)
      const tempId = createPrefixedId('p_tmp');
      const optimistic: Panel = { ...(deepCloneStructured(panel) as Panel), id: tempId };
      addPanelLocal.call(this, groupId, optimistic);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const createFn = api.dashboard.createPanel;
        if (!createFn) throw new Error('DashboardService.createPanel is not implemented');

        const payload = deepCloneStructured(panel) as any;
        delete payload.id;

        const res = await createFn({ dashboardId, groupId, panel: payload });
        if (opSeq !== this._remoteOpSeq) return;

        const createdPanel = deepCloneStructured(res.panel) as Panel;
        const createdLayout = res.layout ? (deepCloneStructured(res.layout) as PanelLayout) : undefined;

        this._replaceTempPanelIdOnCurrent(groupId, tempId, createdPanel, createdLayout);
        this._upsertPanelOnDashboard(this.syncedDashboard, groupId, createdPanel);
        if (createdLayout) this._upsertLayoutItemsOnDashboard(this.syncedDashboard, groupId, [createdLayout]);

        // 创建后默认跳到最后一页（固定 20/页）
        this.requestPanelGroupPageJump(groupId, this._getPanelGroupPageCount(groupId, 20));
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to create panel';
        this.lastError = `新增面板失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 更新面板（编辑器保存）
     */
    async updatePanel(groupId: ID, panelId: ID, updates: Partial<Panel>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      updatePanelLocal.call(this, groupId, panelId, updates);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const updateFn = api.dashboard.updatePanel;
        if (!updateFn) throw new Error('DashboardService.updatePanel is not implemented');

        const current = this.getPanelById(groupId, panelId);
        if (!current) throw new Error('Panel not found');
        const payload = deepCloneStructured(current) as any;
        delete payload.id;

        const res = await updateFn({ dashboardId, groupId, panelId, panel: payload });
        if (opSeq !== this._remoteOpSeq) return;

        const saved = deepCloneStructured(res.panel) as Panel;
        updatePanelLocal.call(this, groupId, panelId, saved);
        this._upsertPanelOnDashboard(this.syncedDashboard, groupId, saved);
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to update panel';
        this.lastError = `保存面板失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 删除面板
     */
    async deletePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      deletePanelLocal.call(this, groupId, panelId);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const delFn = api.dashboard.deletePanel;
        if (!delFn) throw new Error('DashboardService.deletePanel is not implemented');

        await delFn({ dashboardId, groupId, panelId });
        if (opSeq !== this._remoteOpSeq) return;

        this._removePanelFromDashboard(this.syncedDashboard, groupId, panelId);
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to delete panel';
        this.lastError = `删除面板失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 复制面板（后端生成新 id 并返回）
     */
    async duplicatePanel(groupId: ID, panelId: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      const src = this.getPanelById(groupId, panelId);
      if (!src) throw new Error('Panel not found');

      const tempId = createPrefixedId('p_tmp');
      const optimistic: Panel = { ...(deepCloneStructured(src) as Panel), id: tempId, name: `${src.name} (副本)` };
      addPanelLocal.call(this, groupId, optimistic);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const dupFn = api.dashboard.duplicatePanel;
        if (!dupFn) throw new Error('DashboardService.duplicatePanel is not implemented');

        const res = await dupFn({ dashboardId, groupId, panelId });
        if (opSeq !== this._remoteOpSeq) return;

        const duplicated = deepCloneStructured(res.panel) as Panel;
        const duplicatedLayout = res.layout ? (deepCloneStructured(res.layout) as PanelLayout) : undefined;

        this._replaceTempPanelIdOnCurrent(groupId, tempId, duplicated, duplicatedLayout);
        this._upsertPanelOnDashboard(this.syncedDashboard, groupId, duplicated);
        if (duplicatedLayout) this._upsertLayoutItemsOnDashboard(this.syncedDashboard, groupId, [duplicatedLayout]);

        this.requestPanelGroupPageJump(groupId, this._getPanelGroupPageCount(groupId, 20));
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to duplicate panel';
        this.lastError = `复制面板失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 创建面板组（后端生成新 id 并返回）
     */
    async addPanelGroup(group: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      const tempId = createPrefixedId('pg_tmp');
      addPanelGroupLocal.call(this, { ...(group as any), id: tempId });

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const createFn = api.dashboard.createPanelGroup;
        if (!createFn) throw new Error('DashboardService.createPanelGroup is not implemented');

        const res = await createFn({
          dashboardId,
          group: {
            title: String(group?.title ?? '新面板组'),
            description: group?.description,
          },
        });
        if (opSeq !== this._remoteOpSeq) return;

        const created = deepCloneStructured(res.group) as PanelGroup;
        // Replace temp group id with backend-generated id (keep array order stable)
        const dash = this.currentDashboard;
        const idx = dash.panelGroups.findIndex((g) => String(g.id) === String(tempId));
        if (idx >= 0) {
          dash.panelGroups[idx] = created;
        } else {
          dash.panelGroups.push(created);
        }
        // Normalize order fields to match current array order
        dash.panelGroups.forEach((g, i) => (g.order = i));

        if (this.syncedDashboard) {
          this.syncedDashboard.panelGroups ??= [];
          this.syncedDashboard.panelGroups.push(deepCloneStructured(created) as PanelGroup);
          this.syncedDashboard.panelGroups.forEach((g, i) => (g.order = i));
        }

        this.markDashboardDirty({ hasUnsyncedChanges: false });
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to create panel group';
        this.lastError = `创建面板组失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 更新面板组（标题/描述）
     */
    async updatePanelGroup(id: ID, updates: Partial<PanelGroup>) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      updatePanelGroupLocal.call(this, id, updates);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const updateFn = api.dashboard.updatePanelGroup;
        if (!updateFn) throw new Error('DashboardService.updatePanelGroup is not implemented');

        const title = String(updates.title ?? this._getGroupFromDashboard(this.currentDashboard, id)?.title ?? '');
        const description = updates.description ?? this._getGroupFromDashboard(this.currentDashboard, id)?.description;

        const res = await updateFn({ dashboardId, groupId: id, group: { title, description } });
        if (opSeq !== this._remoteOpSeq) return;

        const saved = deepCloneStructured(res.group) as PanelGroup;
        // 仅更新元信息（title/description），避免把 current 的 panels/layout 引用写进 syncedSnapshot
        updatePanelGroupLocal.call(this, id, { title: saved.title, description: saved.description } as any);

        if (this.syncedDashboard) {
          const sg = this._getGroupFromDashboard(this.syncedDashboard, id);
          if (sg) {
            sg.title = saved.title ?? sg.title;
            sg.description = saved.description ?? sg.description;
          }
        }
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to update panel group';
        this.lastError = `更新面板组失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 删除面板组
     */
    async deletePanelGroup(id: ID) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      deletePanelGroupLocal.call(this, id);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const delFn = api.dashboard.deletePanelGroup;
        if (!delFn) throw new Error('DashboardService.deletePanelGroup is not implemented');

        await delFn({ dashboardId, groupId: id });
        if (opSeq !== this._remoteOpSeq) return;

        if (this.syncedDashboard) {
          this.syncedDashboard.panelGroups = (this.syncedDashboard.panelGroups ?? []).filter((g) => String(g.id) !== String(id));
          (this.syncedDashboard.panelGroups ?? []).forEach((g, idx) => (g.order = idx));
        }
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to delete panel group';
        this.lastError = `删除面板组失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
      }
    },

    /**
     * 面板组重排（拖拽排序）
     */
    async reorderPanelGroups(nextOrder: ID[]) {
      if (!this.currentDashboard) return;
      if (this.isBooting) return;
      if (this.isReadOnly) throw new Error('Dashboard is read-only');

      const dashboardId = this.dashboardId;
      if (!dashboardId) throw new Error('Missing dashboardId. Call loadDashboard(dashboardId) first.');

      reorderPanelGroupsLocal.call(this, nextOrder);

      const opSeq = this._remoteOpSeq;
      try {
        const api = getPiniaApiClient(this.$pinia);
        const reorderFn = api.dashboard.reorderPanelGroups;
        if (!reorderFn) throw new Error('DashboardService.reorderPanelGroups is not implemented');

        await reorderFn({ dashboardId, order: nextOrder });
        if (opSeq !== this._remoteOpSeq) return;

        if (this.syncedDashboard) {
          // apply the same reorder logic to synced snapshot
          const groups = this.syncedDashboard.panelGroups ?? [];
          const byId = new Map<string, PanelGroup>();
          for (const g of groups) byId.set(String(g.id), g);

          const used = new Set<string>();
          const next: PanelGroup[] = [];
          for (const rawId of nextOrder ?? []) {
            const key = String(rawId);
            const g = byId.get(key);
            if (!g) continue;
            if (used.has(key)) continue;
            used.add(key);
            next.push(g);
          }
          for (const g of groups) {
            const key = String(g.id);
            if (used.has(key)) continue;
            used.add(key);
            next.push(g);
          }
          next.forEach((g, idx) => (g.order = idx));
          this.syncedDashboard.panelGroups = next;
        }
        this.hasUnsyncedChanges = false;
        this.lastError = null;
      } catch (error) {
        if (opSeq !== this._remoteOpSeq) return;
        const msg = error instanceof Error ? error.message : 'Failed to reorder panel groups';
        this.lastError = `面板组排序失败，已回滚：${msg}`;
        this.resetToSynced();
        throw error;
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

    // ---- Dashboard view/UI state mutations ----
    setEditingGroup,
    toggleGroupEditing,
    setViewMode,
    togglePanelsView,
    setViewPanel,
    togglePanelView,

    // ---- (Optional) local-only helpers kept for compatibility ----
    movePanelGroup: movePanelGroupLocal,
    updatePanelGroupLayout: updatePanelGroupLayoutLocal,
  },
});
