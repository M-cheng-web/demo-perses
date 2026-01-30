<!--
  文件说明：Dashboard 根组件

  职责：
  - 提供运行时依赖（apiClient / runtimeContext）
  - 渲染工具栏、面板组、编辑器、全屏弹窗、全局 Tooltip 等
  - 处理多实例隔离：鼠标跟踪、依赖注入与 pinia 附加依赖绑定
-->
<template>
  <ConfigProvider :theme="props.theme">
    <div ref="rootEl" :class="bem()" :style="rootStyle">
      <!-- 右侧透明设置按钮：打开侧边栏工具面板 -->
      <div ref="settingsEl" :class="[bem('settings'), { 'is-dragging': isSettingsDragging, 'is-peek': isSettingsPeek }]" :style="settingsStyle">
        <Button
          type="text"
          size="middle"
          :icon="h(SettingOutlined)"
          :disabled="isBooting"
          @click="handleSettingsClick"
          @pointerdown="handleSettingsPointerDown"
        />
      </div>

      <!-- 工具栏侧边栏（复用 DashboardToolbar 内容） -->
      <Drawer v-model:open="settingsOpen" title="设置" :width="520" :footer="false" :mask="true" :mask-closable="true">
        <DashboardToolbar ref="toolbarRef" variant="sidebar" />
      </Drawer>

      <!-- 面板组列表 -->
      <div ref="contentEl" :class="[bem('content'), { 'is-locked': isFocusLayerActive }]" :style="contentStyle">
        <Empty v-if="!panelGroups.length" :description="emptyText">
          <Button type="primary" :disabled="isBooting" @click="handleAddPanelGroup"> 创建面板组 </Button>
        </Empty>

        <template v-else>
          <AllPanelsView v-if="isAllPanelsView" :panel-groups="panelGroups" />
          <PanelGroupList
            v-else
            :panel-groups="panelGroups"
            :focused-group-id="focusedGroupId"
            @create-group="handleCreateGroup"
            @edit-group="handleEditGroup"
            @open-group="handleOpenGroup"
          />
        </template>
      </div>

      <!-- 面板组聚焦层（打开组时不改变底层滚动位置） -->
      <PanelGroupFocusLayer
        v-if="!isAllPanelsView && focusedGroupId != null"
        v-model:open="focusOpen"
        :start-offset-y="focusStartOffsetY"
        :paged-group="focusedPagedGroup"
        :page-size-options="pageSizeOptions"
        :pager-threshold="pagerThreshold"
        :is-booting="isBooting"
        :set-current-page="setCurrentPage"
        :set-page-size="setPageSize"
        @after-close="handleFocusAfterClose"
        @edit-group="handleEditGroup"
      />

      <!-- 面板编辑器 -->
      <PanelEditorDrawer />

      <!-- 全屏查看面板 -->
      <PanelFullscreenModal ref="fullscreenModalRef" />

      <!-- 全局唯一的 Tooltip -->
      <GlobalChartTooltip />

      <!-- 全局面板组编辑对话框 -->
      <PanelGroupDialog ref="panelGroupDialogRef" />

      <!-- 全局 Loading Mask：boot 阶段锁住交互（禁止滚动/折叠/点击） -->
      <div v-if="isBooting" :class="bem('boot-mask')" @wheel.prevent @touchmove.prevent @pointerdown.prevent @keydown.prevent>
        <div :class="bem('boot-card')">
          <Loading :text="bootTitle" />
          <div :class="bem('boot-detail')">{{ bootDetail }}</div>
          <div v-if="isLargeDashboard" :class="bem('boot-hint')">检测到数据量较大，首次加载可能需要更久，请耐心等待</div>
        </div>
      </div>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted, computed, provide, inject, h, nextTick } from 'vue';
  import { getActivePinia, storeToRefs, type Pinia } from '@grafana-fast/store';
  import { Button, ConfigProvider, Drawer, Empty, Loading, message } from '@grafana-fast/component';
  import { SettingOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useEditorStore, useTimeRangeStore, useTooltipStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import { DASHBOARD_EMPTY_TEXT } from '/#/components/Dashboard/utils';
  import DashboardToolbar from './DashboardToolbar.vue';
  import PanelGroupList from '/#/components/PanelGroup/PanelGroupList.vue';
  import PanelGroupFocusLayer from '/#/components/PanelGroup/PanelGroupFocusLayer.vue';
  import AllPanelsView from './AllPanelsView.vue';
  import PanelEditorDrawer from '/#/components/PanelEditor/PanelEditorDrawer.vue';
  import PanelFullscreenModal from '/#/components/Panel/PanelFullscreenModal.vue';
  import GlobalChartTooltip from '/#/components/ChartTooltip/GlobalChartTooltip.vue';
  import PanelGroupDialog from '/#/components/PanelGroup/PanelGroupDialog.vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import type { GrafanaFastApiClient } from '@grafana-fast/api';
  import { createMockApiClient } from '@grafana-fast/api';
  import { GF_API_KEY, GF_RUNTIME_KEY } from '/#/runtime/keys';
  import { setPiniaApiClient } from '/#/runtime/piniaAttachments';
  import { usePanelGroupPagination } from '/#/composables/usePanelGroupPagination';

  const [_, bem] = createNamespace('dashboard');

  const props = withDefaults(
    defineProps<{
      /**
       * Dashboard 根节点使用的主题模式
       * - 'inherit': 跟随 document / 父级 tokens（推荐：嵌入到宿主应用时使用）
       * - 'light'/'blue': 强制浅色方案
       * - 'dark': 强制深色方案
       */
      theme?: 'blue' | 'light' | 'dark' | 'inherit';
      /**
       * 可选：运行时注入的 apiClient（接口契约 + 实现）
       * 未提供时默认使用 mock 实现
       */
      apiClient?: GrafanaFastApiClient;
      /**
       * Dashboard 实例唯一 id（用于多实例隔离）
       *
       * 建议：
       * - 宿主应用应为每个 Dashboard 实例传入稳定且唯一的 id
       * - 用于本地持久化（例如设置按钮位置）、调度器 scope、日志/调试定位等
       */
      instanceId: string;
    }>(),
    {
      theme: 'inherit',
      apiClient: undefined,
    }
  );

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const timeRangeStore = useTimeRangeStore();
  const tooltipStore = useTooltipStore();
  const { panelGroups, editingGroupId, viewMode, viewPanel, isBooting, bootStage, bootStats, isLargeDashboard } = storeToRefs(dashboardStore);
  const fullscreenModalRef = ref<InstanceType<typeof PanelFullscreenModal>>();
  const panelGroupDialogRef = ref<InstanceType<typeof PanelGroupDialog>>();
  const rootEl = ref<HTMLElement | null>(null);
  const contentEl = ref<HTMLElement | null>(null);
  const toolbarRef = ref<any>(null);
  const settingsOpen = ref(false);
  const settingsEl = ref<HTMLElement | null>(null);

  const emptyText = computed(() => DASHBOARD_EMPTY_TEXT);

  const instanceId = computed(() => props.instanceId);

  const isAllPanelsView = computed(() => viewMode.value === 'allPanels');
  const isEditingActive = computed(() => editingGroupId.value != null);

  // ---------------------------
  // Settings button position (per dashboard instance)
  // ---------------------------
  const SETTINGS_POS_KEY_PREFIX = 'gf-dashboard-settings-pos:';
  const settingsPos = ref<{ x: number; y: number } | null>(null);
  const isSettingsDragging = ref(false);
  const suppressSettingsClick = ref(false);
  let settingsDragPointerId: number | null = null;
  let settingsDragMoved = false;
  let settingsDragStartClientX = 0;
  let settingsDragStartClientY = 0;
  let settingsDragStartX = 0;
  let settingsDragStartY = 0;

  const settingsStorageKey = computed(() => `${SETTINGS_POS_KEY_PREFIX}${instanceId.value}`);

  // “半隐藏”交互：
  // - 默认位置（未被拖动/未持久化）半隐藏在右侧
  // - 用户拖动后，如果贴到右侧边缘，也自动半隐藏（减少遮挡内容）
  const SETTINGS_PEEK_EDGE_PX = 10;
  const SETTINGS_SNAP_EDGE_PX = 10;

  const getSettingsButtonSize = (): { w: number; h: number } => {
    const rect = settingsEl.value?.getBoundingClientRect();
    const w = rect?.width ?? 34;
    const h = rect?.height ?? 34;
    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  };

  const clampSettingsPos = (pos: { x: number; y: number }): { x: number; y: number } => {
    const root = rootEl.value;
    if (!root) return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
    const { w, h } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    const maxY = Math.max(0, Math.floor(root.clientHeight - h));
    const x = Math.min(maxX, Math.max(0, Math.floor(pos.x)));
    const y = Math.min(maxY, Math.max(0, Math.floor(pos.y)));
    return { x, y };
  };

  const clampSettingsPosInPlace = () => {
    if (!settingsPos.value) return;
    settingsPos.value = clampSettingsPos(settingsPos.value);
  };

  const isSettingsNearRightEdge = (pos: { x: number; y: number }): boolean => {
    const root = rootEl.value;
    if (!root) return false;
    const { w } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    // maxX=0 表示容器太窄/按钮太宽：此时不做 peek（避免按钮完全不可见）
    if (maxX <= 0) return false;
    const x = Math.floor(Number(pos.x ?? 0));
    return x >= maxX - SETTINGS_PEEK_EDGE_PX;
  };

  const isSettingsPeek = computed(() => {
    if (isSettingsDragging.value) return false;
    // 未被拖动/未持久化：默认半隐藏在右侧
    if (!settingsPos.value) return true;
    // 已拖动：贴到右侧也半隐藏
    return isSettingsNearRightEdge(settingsPos.value);
  });

  const snapSettingsPos = (pos: { x: number; y: number }): { x: number; y: number } => {
    const root = rootEl.value;
    if (!root) return clampSettingsPos(pos);
    const clamped = clampSettingsPos(pos);
    const { w } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    if (maxX > 0 && clamped.x >= maxX - SETTINGS_SNAP_EDGE_PX) {
      return { x: maxX, y: clamped.y };
    }
    return clamped;
  };

  const loadSettingsPos = () => {
    try {
      const raw = localStorage.getItem(settingsStorageKey.value);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      settingsPos.value = clampSettingsPos({ x, y });
    } catch {
      // ignore
    }
  };

  const saveSettingsPos = () => {
    try {
      if (!settingsPos.value) return;
      localStorage.setItem(settingsStorageKey.value, JSON.stringify(settingsPos.value));
    } catch {
      // ignore
    }
  };

  const settingsStyle = computed(() => {
    if (!settingsPos.value) return undefined;
    return {
      left: `${settingsPos.value.x}px`,
      top: `${settingsPos.value.y}px`,
      right: 'auto',
    } as Record<string, string>;
  });

  // ---------------------------
  // Pagination state (per group)
  // ---------------------------
  const {
    pagedGroups,
    pageSizeOptions,
    setCurrentPage: baseSetCurrentPage,
    setPageSize: baseSetPageSize,
  } = usePanelGroupPagination(() => panelGroups.value, {
    defaultPageSize: 20,
    pageSizeOptions: [20, 30],
    resetPageOnPageSizeChange: true,
  });
  const pagerThreshold = computed(() => Math.min(...pageSizeOptions.value, 20));

  /**
   * 编辑态 + 分页/切组：统一收口一些“边界行为”，避免出现
   * - 编辑器抽屉停留在“已不可见的面板”
   * - 切页后仍对上一页面板做编辑/保存，导致误解
   *
   * 规则：
   * - 切换分页（current/pageSize）会关闭 PanelEditorDrawer
   * - 切换聚焦组（打开另一个组）也会关闭 PanelEditorDrawer
   */
  const setCurrentPage = (groupId: PanelGroup['id'], page: number) => {
    if (isEditingActive.value) editorStore.closeEditor();
    baseSetCurrentPage(groupId, page);
  };

  const setPageSize = (groupId: PanelGroup['id'], pageSize: number) => {
    if (isEditingActive.value) editorStore.closeEditor();
    baseSetPageSize(groupId, pageSize);
  };

  // ---------------------------
  // Focus layer (open one group without changing background scroll)
  // ---------------------------
  const focusedGroupId = ref<PanelGroup['id'] | null>(null);
  const focusStartOffsetY = ref(0);
  const focusOpen = ref(false);

  const focusedPagedGroup = computed(() => {
    if (focusedGroupId.value == null) return null;
    return pagedGroups.value.find((pg) => String(pg.group.id) === String(focusedGroupId.value)) ?? null;
  });

  // 如果聚焦中的组被删除/替换，清理聚焦层状态（避免残留锁滚动状态）
  watch(focusedPagedGroup, (pg) => {
    if (focusedGroupId.value == null) return;
    if (pg) return;
    focusedGroupId.value = null;
    focusOpen.value = false;
    focusStartOffsetY.value = 0;
  });

  const isFocusLayerActive = computed(() => !isAllPanelsView.value && focusedGroupId.value != null);

  // ---------------------------
  // Host container height syncing
  // ---------------------------
  // 目标：Dashboard 自己感知“被挂载的容器”的可用高度，并把自己 height 锁定为该高度，
  // 这样宿主只需要控制挂载容器的尺寸即可（无需 dashboard 内部写死固定高度）。
  const hostHeightPx = ref<number | null>(null);
  let hostResizeObserver: ResizeObserver | null = null;
  let observedHostEl: HTMLElement | null = null;
  let isWindowResizeBound = false;

  const resolveHostEl = (): HTMLElement | null => rootEl.value?.parentElement ?? null;

  const updateHostHeight = () => {
    const host = resolveHostEl();
    if (!host) {
      hostHeightPx.value = null;
      return;
    }
    const next = Math.floor(host.clientHeight);
    hostHeightPx.value = next > 0 ? next : null;
    clampSettingsPosInPlace();
  };

  const detachHostObserver = () => {
    if (hostResizeObserver) {
      hostResizeObserver.disconnect();
    }
    observedHostEl = null;
    if (isWindowResizeBound) {
      window.removeEventListener('resize', updateHostHeight);
      isWindowResizeBound = false;
    }
  };

  const attachHostObserver = () => {
    const host = resolveHostEl();
    if (!host || observedHostEl === host) {
      updateHostHeight();
      return;
    }

    detachHostObserver();
    observedHostEl = host;

    if (typeof ResizeObserver !== 'undefined') {
      hostResizeObserver = hostResizeObserver ?? new ResizeObserver(() => updateHostHeight());
      hostResizeObserver.observe(host);
    } else {
      // 极端兜底：老环境无 ResizeObserver
      window.addEventListener('resize', updateHostHeight, { passive: true } as AddEventListenerOptions);
      isWindowResizeBound = true;
    }

    updateHostHeight();
  };

  const rootStyle = computed(() => {
    const style: Record<string, string> = {};
    if (hostHeightPx.value && hostHeightPx.value > 0) {
      style.height = `${hostHeightPx.value}px`;
      style['--dp-dashboard-host-height'] = `${hostHeightPx.value}px`;
    }
    return style;
  });

  const contentStyle = computed(() => {
    // 聚焦层打开时禁止外层滚动：用户只通过聚焦层的内容区滚动
    if (!isFocusLayerActive.value) return undefined;
    return { overflow: 'hidden' } as Record<string, string>;
  });

  const handleOpenGroup = (payload: { groupId: PanelGroup['id']; headerOffsetY: number }) => {
    if (isBooting.value) return;
    if (isAllPanelsView.value) return;
    if (isEditingActive.value) editorStore.closeEditor();
    dashboardStore.setEditingGroup(null);
    focusedGroupId.value = payload.groupId;
    focusStartOffsetY.value = payload.headerOffsetY;
    focusOpen.value = true;
  };

  // ---------------------------
  // Default open behavior: single group
  // ---------------------------
  // 需求：当仅有一个面板组时，默认打开该面板组。
  // 注意：这里只做“默认打开一次”，不强制锁定。用户手动关闭后不自动再次打开。
  const autoOpenedSingleGroup = ref(false);
  watch(isBooting, (booting) => {
    if (booting) autoOpenedSingleGroup.value = false;
  });

  watch(
    [isBooting, viewMode, () => panelGroups.value.length],
    ([booting, mode, groupCount]) => {
      if (booting) return;
      if (autoOpenedSingleGroup.value) return;
      if (mode !== 'grouped') return;
      if (groupCount !== 1) return;
      if (focusedGroupId.value != null) return;
      const only = panelGroups.value[0];
      if (!only) return;
      handleOpenGroup({ groupId: only.id, headerOffsetY: 0 });
      autoOpenedSingleGroup.value = true;
    },
    { immediate: true }
  );

  const handleFocusAfterClose = () => {
    if (isEditingActive.value) editorStore.closeEditor();
    dashboardStore.setEditingGroup(null);
    focusedGroupId.value = null;
    focusStartOffsetY.value = 0;
  };

  const openSettings = () => {
    if (isBooting.value) return;
    settingsOpen.value = true;
  };

  const closeSettings = () => {
    settingsOpen.value = false;
  };

  const toggleSettings = () => {
    if (isBooting.value) return;
    settingsOpen.value = !settingsOpen.value;
  };

  const handleSettingsClick = () => {
    if (suppressSettingsClick.value) {
      suppressSettingsClick.value = false;
      return;
    }
    openSettings();
  };

  const getCurrentSettingsPosFromDom = (): { x: number; y: number } => {
    const root = rootEl.value;
    const el = settingsEl.value;
    if (!root || !el) return { x: 0, y: 0 };
    const rootRect = root.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return clampSettingsPos({ x: elRect.left - rootRect.left, y: elRect.top - rootRect.top });
  };

  const endSettingsDrag = () => {
    window.removeEventListener('pointermove', handleSettingsPointerMove);
    window.removeEventListener('pointerup', handleSettingsPointerUp);
    window.removeEventListener('pointercancel', handleSettingsPointerUp);
    isSettingsDragging.value = false;
    settingsDragPointerId = null;
  };

  const handleSettingsPointerDown = (event: PointerEvent) => {
    if (isBooting.value) return;
    if (settingsDragPointerId != null) return;
    settingsDragPointerId = event.pointerId;
    settingsDragMoved = false;
    suppressSettingsClick.value = false;

    const initial = settingsPos.value ?? getCurrentSettingsPosFromDom();
    settingsPos.value = initial;
    settingsDragStartX = initial.x;
    settingsDragStartY = initial.y;
    settingsDragStartClientX = event.clientX;
    settingsDragStartClientY = event.clientY;
    isSettingsDragging.value = true;

    window.addEventListener('pointermove', handleSettingsPointerMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener('pointerup', handleSettingsPointerUp, { passive: true } as AddEventListenerOptions);
    window.addEventListener('pointercancel', handleSettingsPointerUp, { passive: true } as AddEventListenerOptions);

    try {
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  };

  const handleSettingsPointerMove = (event: PointerEvent) => {
    if (settingsDragPointerId == null) return;
    if (event.pointerId !== settingsDragPointerId) return;
    const dx = event.clientX - settingsDragStartClientX;
    const dy = event.clientY - settingsDragStartClientY;
    if (!settingsDragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) settingsDragMoved = true;
    if (!settingsDragMoved) return;
    event.preventDefault();
    settingsPos.value = clampSettingsPos({ x: settingsDragStartX + dx, y: settingsDragStartY + dy });
  };

  const handleSettingsPointerUp = (event: PointerEvent) => {
    if (settingsDragPointerId == null) return;
    if (event.pointerId !== settingsDragPointerId) return;

    if (settingsDragMoved) {
      suppressSettingsClick.value = true;
      if (settingsPos.value) settingsPos.value = snapSettingsPos(settingsPos.value);
      saveSettingsPos();
    }
    endSettingsDrag();
  };

  // Provide runtime-scoped dependencies
  const apiClient = computed(() => props.apiClient ?? createMockApiClient());
  provide(GF_API_KEY, apiClient.value);
  provide(GF_RUNTIME_KEY, { id: instanceId.value, rootEl, scrollEl: contentEl });

  // NOTE: inject() must be called during setup (not inside onMounted).
  const injectedPinia = inject<Pinia | undefined>('pinia', undefined);

  // Also attach to active pinia so stores (non-component) can access the instance-scoped dependencies.
  onMounted(() => {
    // Prefer injected pinia for multi-instance isolation (multiple Vue apps on one page).
    const active = injectedPinia ?? getActivePinia();
    if (active) {
      setPiniaApiClient(active, apiClient.value);
    }
  });

  const handleAddPanelGroup = () => {
    if (isBooting.value) return;
    panelGroupDialogRef.value?.openCreate?.();
  };

  const handleCreateGroup = () => {
    handleAddPanelGroup();
  };

  const handleEditGroup = (group: PanelGroup) => {
    panelGroupDialogRef.value?.openEdit(group);
  };

  // 监听 viewPanel 变化，打开或关闭全屏模态框
  watch(viewPanel, (panel) => {
    if (panel && fullscreenModalRef.value) {
      fullscreenModalRef.value.open(panel);
    }
  });

  // 全部面板视图为只读：进入时关闭编辑器抽屉（避免残留编辑态 UI）
  watch(viewMode, (mode) => {
    if (mode === 'allPanels') {
      editorStore.closeEditor();
      dashboardStore.setEditingGroup(null);
      focusedGroupId.value = null;
      focusOpen.value = false;
    }
  });

  /**
   * 全局鼠标移动监听
   * 实时更新鼠标位置到 tooltipStore
   */
  const handleGlobalMouseMove = (event: MouseEvent) => {
    tooltipStore.updateGlobalMousePosition({
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  };

  const bindPointerTracking = (el: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
  };

  const unbindPointerTracking = (el: HTMLElement | null) => {
    if (!el) return;
    el.removeEventListener('mousemove', handleGlobalMouseMove);
  };

  // 生命周期钩子
  onMounted(() => {
    bindPointerTracking(rootEl.value);
    attachHostObserver();
    // 延后一帧：确保 root/host 尺寸已稳定（便于恢复并 clamp 拖拽位置）
    void nextTick(() => {
      loadSettingsPos();
      clampSettingsPosInPlace();
    });
  });

  onUnmounted(() => {
    unbindPointerTracking(rootEl.value);
    detachHostObserver();
  });

  // root element changes (unlikely) -> rebind
  watch(
    rootEl,
    (el, prev) => {
      unbindPointerTracking(prev ?? null);
      bindPointerTracking(el ?? null);
      attachHostObserver();
    },
    { immediate: false }
  );

  const bootTitle = computed(() => {
    switch (bootStage.value) {
      case 'fetching':
        return '正在加载仪表盘配置...';
      case 'parsing':
        return '正在解析仪表盘 JSON...';
      case 'initializing':
        return '正在初始化面板...';
      default:
        return '正在加载...';
    }
  });

  const bootDetail = computed(() => {
    const parts: string[] = [];
    const src = bootStats.value.source === 'import' ? '导入' : '加载';
    parts.push(`来源：${src}`);
    if (typeof bootStats.value.groupCount === 'number') parts.push(`面板组：${bootStats.value.groupCount}`);
    if (typeof bootStats.value.panelCount === 'number') parts.push(`面板：${bootStats.value.panelCount}`);
    if (typeof bootStats.value.jsonBytes === 'number') {
      const mb = (bootStats.value.jsonBytes / 1024 / 1024).toFixed(2);
      parts.push(`JSON：${mb}MB`);
    }
    return parts.join(' / ');
  });

  const ensureToolbarMounted = async () => {
    if (toolbarRef.value) return;
    openSettings();
    await nextTick();
  };

  const toolbarApi = {
    // JSON modal（依赖 toolbar UI）
    openJsonModal: async (mode: 'view' | 'edit' = 'view') => {
      await ensureToolbarMounted();
      toolbarRef.value?.openJsonModal?.(mode);
    },
    closeJsonModal: async () => {
      await ensureToolbarMounted();
      toolbarRef.value?.closeJsonModal?.();
    },

    // Core actions（无 UI 也可执行）
    refresh: () => {
      if (isBooting.value) return;
      timeRangeStore.refresh();
      message.success('已刷新');
    },
    save: async () => {
      if (isBooting.value) return;
      await dashboardStore.saveDashboard();
    },
    togglePanelsView: () => {
      if (isBooting.value) return;
      dashboardStore.togglePanelsView();
    },
    addPanelGroup: () => {
      if (isBooting.value) return;
      dashboardStore.addPanelGroup({ title: '新面板组', description: '' });
    },

    // JSON import/export（export 可无 UI，import/view/apply 依赖 toolbar UI）
    exportJson: () => {
      if (isBooting.value) return;
      const dash = dashboardStore.currentDashboard;
      if (!dash) {
        message.error('没有可导出的 Dashboard');
        return;
      }
      const json = JSON.stringify(dash, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${dash.name}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    },
    importJson: async () => {
      await ensureToolbarMounted();
      toolbarRef.value?.handleImport?.();
    },
    viewJson: async () => {
      await ensureToolbarMounted();
      toolbarRef.value?.handleViewJson?.();
    },
    applyJson: async () => {
      await ensureToolbarMounted();
      toolbarRef.value?.handleApplyJson?.();
    },

    // Controlled helpers
    setTimeRangePreset: (preset: string) => {
      if (isBooting.value) return;
      timeRangeStore.setTimeRange({ from: preset, to: 'now' });
    },
  };

  defineExpose({
    openSettings,
    closeSettings,
    toggleSettings,
    toolbar: toolbarApi,
  });
</script>

<style scoped lang="less">
  @import '/#/assets/styles/variables.less';

  .dp-dashboard {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    // 嵌入式：不提供背景/网格/留白，交给宿主控制
    background: transparent;

    > * {
      position: relative;
      z-index: 1;
    }

    // overlay components must not be forced into normal flow by `> * { position: relative }`
    :deep(.dp-panel-group-focus-layer) {
      position: absolute;
      inset: 0;
      z-index: 140;
    }

    &__content {
      flex: 1;
      overflow: auto;
      padding: 0;

      > * {
        width: 100%;
      }
    }

    &__settings {
      position: absolute;
      right: 0;
      top: 12px;
      transform: none;
      z-index: 180;
      user-select: none;
      touch-action: none;
      cursor: grab;
      transition:
        transform var(--gf-motion-normal) var(--gf-easing),
        opacity var(--gf-motion-fast) var(--gf-easing);

      &.is-peek {
        transform: translateX(50%);
        opacity: 0.95;
      }

      &.is-peek:hover {
        transform: translateX(0%);
        opacity: 1;
      }

      :deep(.gf-button) {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid var(--gf-color-border-strong);
        background: color-mix(in srgb, var(--gf-color-surface), transparent 6%);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: var(--gf-shadow-2);
        cursor: grab;
        font-size: 18px;
      }

      :deep(.gf-button:hover) {
        background: color-mix(in srgb, var(--gf-color-surface), transparent 0%);
        border-color: var(--gf-color-border-strong);
        box-shadow: var(--gf-shadow-2);
      }

      &.is-dragging {
        cursor: grabbing;

        :deep(.gf-button) {
          cursor: grabbing;
        }
      }
    }

    &__boot-mask {
      position: absolute;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      // 嵌入式场景：遮罩层尽量使用不透明 surface，避免“底层内容透出/叠印”
      background: var(--gf-color-surface);
      cursor: progress;
    }

    &__boot-card {
      width: min(560px, 100%);
      padding: 16px 16px 14px;
      border-radius: var(--gf-radius-md);
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-muted);
      box-shadow: var(--gf-shadow-2);
    }

    &__boot-detail {
      margin-top: 10px;
      font-size: 12px;
      color: var(--gf-color-text-secondary);
      line-height: 1.45;
      word-break: break-word;
    }

    &__boot-hint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--gf-color-warning-text, var(--gf-color-text-secondary));
      line-height: 1.45;
    }
  }
</style>
