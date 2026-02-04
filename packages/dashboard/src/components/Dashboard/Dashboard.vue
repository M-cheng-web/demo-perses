<!--
  文件说明：Dashboard 根组件

  职责：
  - 提供运行时依赖（apiClient / runtimeContext）
  - 渲染工具栏、面板组、编辑器、全屏弹窗、全局 Tooltip 等
  - 处理多实例隔离：鼠标跟踪、依赖注入与 pinia 附加依赖绑定
-->
<template>
  <ConfigProvider :theme="props.theme" :portal-target="props.portalTarget">
    <div ref="rootEl" :class="bem()" :style="rootStyle">
      <!-- 右侧透明设置按钮：打开侧边栏工具面板 -->
      <div ref="settingsEl" :class="[bem('settings'), { 'is-dragging': isSettingsDragging, 'is-peek': isSettingsPeek }]" :style="settingsStyle">
        <Button
          icon-only
          type="text"
          size="middle"
          :icon="h(SettingOutlined)"
          :class="bem('settings-btn')"
          :disabled="isBooting"
          @click="handleSettingsClick"
          @pointerdown="handleSettingsPointerDown"
        />
      </div>

      <!-- 工具栏侧边栏（复用 DashboardToolbar 内容） -->
      <Drawer
        v-model:open="settingsOpen"
        title="全局设置"
        :subtitle="settingsSubtitle"
        :width="520"
        :confirmable="true"
        :mask="true"
        :mask-closable="false"
        :lock-scroll="contentEl != null"
        :lock-scroll-el="contentEl"
        @confirm="handleSettingsConfirm"
        @cancel="handleSettingsCancel"
      >
        <DashboardToolbar
          ref="toolbarRef"
          variant="sidebar"
          @create-group="handleCreateGroup"
          @view-json="() => openJsonModal('view')"
          @import-json="handleImportJson"
          @export-json="toolbarApi.exportJson"
        />
      </Drawer>

      <!-- 面板组列表 -->
      <div ref="contentEl" :class="[bem('content'), { 'is-locked': isFocusLayerActive }]" :style="contentStyle">
        <Empty v-if="currentDashboard && !panelGroups.length" :description="emptyText">
          <div :class="bem('empty-hint')">点击右侧“设置”按钮，在工具栏中创建面板组或导入 JSON。</div>
        </Empty>

        <template v-else-if="currentDashboard">
          <AllPanelsView v-if="isAllPanelsView" :panel-groups="panelGroups" />
          <PanelGroupList
            v-else
            :panel-groups="panelGroups"
            :focused-group-id="focusedGroupId"
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
        :motion-ms="panelGroupFocusMotionMs"
        :page-size-options="pageSizeOptions"
        :pager-threshold="pagerThreshold"
        :is-booting="isBooting"
        :set-current-page="setCurrentPage"
        :set-page-size="setPageSize"
        @after-close="handleFocusAfterClose"
        @edit-group="handleEditGroup"
      />

      <!-- 面板编辑器 -->
      <PanelEditorDrawer v-if="panelEditorDrawerLoaded" />

      <!-- 全屏查看面板 -->
      <PanelFullscreenModal ref="fullscreenModalRef" />

      <!-- 全局唯一的 Tooltip -->
      <GlobalChartTooltip />

      <!-- 全局面板组编辑对话框 -->
      <PanelGroupDialog ref="panelGroupDialogRef" />

      <!-- JSON 查看/编辑模态框（SDK/外部可直接唤起，不依赖 settings drawer） -->
      <Modal
        v-model:open="jsonModalVisible"
        title="仪表盘 JSON"
        :width="860"
        destroyOnClose
        :maskClosable="false"
        :lock-scroll="lockScrollEnabled"
        :lock-scroll-el="lockScrollEl"
      >
        <div v-if="isGeneratingJson" :class="bem('json-loading')">正在生成 JSON（内容较大时可能需要几秒）...</div>
        <DashboardJsonEditor
          v-else
          ref="dashboardJsonEditorRef"
          v-model="dashboardJson"
          :read-only="jsonModalMode === 'view'"
          :max-editable-chars="MAX_EDITABLE_DASHBOARD_JSON_CHARS"
          :validate="jsonModalMode === 'edit' ? validateDashboardStrict : undefined"
          @validate="handleJsonValidate"
        />
        <template #footer>
          <Space>
            <Button @click="jsonModalVisible = false">取消</Button>
            <Button v-if="jsonModalMode === 'edit'" type="primary" :disabled="isReadOnly || !isJsonValid || isBooting" @click="handleApplyJson">
              应用
            </Button>
          </Space>
        </template>
      </Modal>

      <!-- 隐藏的文件输入：用于导入 JSON（不依赖 toolbar/drawer） -->
      <input ref="jsonFileInputRef" type="file" accept=".json" style="display: none" @change="handleJsonFileChange" />

      <!-- 全局 Loading Mask：boot 阶段锁住交互（禁止滚动/折叠/点击） -->
      <div v-if="statusKind != null" :class="bem('boot-mask')" @wheel="handleStatusMaskWheel" @touchmove="handleStatusMaskTouchMove">
        <div :class="bem('boot-card')">
          <div :class="bem('status-head')">
            <Loading v-if="statusKind === 'loading'" :text="''" />
            <component v-else :is="statusIcon" :class="[bem('status-icon'), { 'is-error': statusKind === 'error' }]" />
            <div :class="[bem('status-title'), { 'is-error': statusKind === 'error' }]">{{ statusTitle }}</div>
          </div>
          <div :class="bem('boot-detail')">{{ statusDetail }}</div>
          <div v-if="statusHint" :class="bem('boot-hint')">{{ statusHint }}</div>
        </div>
      </div>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ref, watch, computed, defineAsyncComponent, h } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, ConfigProvider, Drawer, Empty, Loading, Modal, Space, message } from '@grafana-fast/component';
  import { ClockCircleOutlined, CloseCircleOutlined, SettingOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useEditorStore, useTimeRangeStore, useTooltipStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import { DASHBOARD_EMPTY_TEXT } from '/#/components/Dashboard/utils';
  import DashboardToolbar from './DashboardToolbar.vue';
  import PanelGroupList from '/#/components/PanelGroup/PanelGroupList.vue';
  import PanelGroupFocusLayer from '/#/components/PanelGroup/PanelGroupFocusLayer.vue';
  import AllPanelsView from './AllPanelsView.vue';
  import PanelFullscreenModal from '/#/components/Panel/PanelFullscreenModal.vue';
  import GlobalChartTooltip from '/#/components/ChartTooltip/GlobalChartTooltip.vue';
  import PanelGroupDialog from '/#/components/PanelGroup/PanelGroupDialog.vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import type { GrafanaFastApiClient } from '@grafana-fast/api';
  import { validateDashboardStrict } from '/#/utils/strictJsonValidators';
  import { usePanelGroupPagination } from '/#/composables/usePanelGroupPagination';
  import { useDashboardJsonModal } from './useDashboardJsonModal';
  import { useDashboardRuntimeBindings } from './useDashboardRuntimeBindings';
  import { useDashboardSettingsUi } from './useDashboardSettingsUi';

  const DashboardJsonEditor = defineAsyncComponent({
    loader: async () => (await import('@grafana-fast/json-editor')).DashboardJsonEditor,
    delay: 120,
    timeout: 30_000,
  });

  const PanelEditorDrawer = defineAsyncComponent({
    loader: async () => (await import('/#/components/PanelEditor/PanelEditorDrawer.vue')).default,
    delay: 120,
    timeout: 30_000,
  });

  const [_, bem] = createNamespace('dashboard');

  const props = withDefaults(
    defineProps<{
      /**
       * Dashboard 根节点使用的主题模式
       * - 'light': 浅色方案（默认）
       * - 'dark': 深色方案
       */
      theme?: 'light' | 'dark';
      /**
       * Portal 挂载点（用于 Modal/Drawer/Dropdown/Select 等 Teleport 浮层）
       *
       * 默认挂到 `body`，嵌入式场景可传入宿主容器以增强隔离/便于销毁。
       */
      portalTarget?: string | HTMLElement | null;
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
      /**
       * 面板组聚焦层 header 动画时长（ms）
       *
       * 说明：
       * - 控制“标题浮起/回落”的 transition duration
       * - 也用于决定何时开始渲染面板列表内容（保证连续感）
       * @default 200
       */
      panelGroupFocusMotionMs?: number;
    }>(),
    {
      theme: 'light',
      portalTarget: null,
      apiClient: undefined,
      panelGroupFocusMotionMs: 200,
    }
  );

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const timeRangeStore = useTimeRangeStore();
  const tooltipStore = useTooltipStore();
  const { isDrawerOpen } = storeToRefs(editorStore);
  const {
    currentDashboard,
    dashboardId,
    panelGroups,
    editingGroupId,
    viewMode,
    viewPanel,
    isBooting,
    isReadOnly,
    bootStage,
    bootStats,
    isLargeDashboard,
    isSaving,
    isSyncing,
    lastError,
  } = storeToRefs(dashboardStore);
  const fullscreenModalRef = ref<InstanceType<typeof PanelFullscreenModal>>();
  const panelGroupDialogRef = ref<InstanceType<typeof PanelGroupDialog>>();
  const rootEl = ref<HTMLElement | null>(null);
  const contentEl = ref<HTMLElement | null>(null);
  const toolbarRef = ref<{ resetSidebarDraft?: () => void; applySidebarDraft?: () => void } | null>(null);
  const settingsEl = ref<HTMLElement | null>(null);

  const emptyText = computed(() => DASHBOARD_EMPTY_TEXT);
  const settingsSubtitle = computed(() => currentDashboard.value?.name || '');

  const instanceId = computed(() => props.instanceId);

  const isAllPanelsView = computed(() => viewMode.value === 'allPanels');
  const isEditingActive = computed(() => editingGroupId.value != null);
  const canEditDashboard = computed(() => !isBooting.value && !isReadOnly.value);
  const panelGroupFocusMotionMs = computed(() => {
    const raw = Number(props.panelGroupFocusMotionMs);
    if (!Number.isFinite(raw)) return 200;
    return Math.max(0, Math.floor(raw));
  });

  const {
    settingsOpen,
    settingsStyle,
    isSettingsDragging,
    isSettingsPeek,
    clampSettingsPosInPlace,
    openSettings,
    closeSettings,
    toggleSettings,
    handleSettingsCancel,
    handleSettingsConfirm,
    handleSettingsClick,
    handleSettingsPointerDown,
  } = useDashboardSettingsUi({
    instanceId,
    rootEl,
    settingsEl,
    isBooting: computed(() => isBooting.value),
    toolbarRef,
  });

  const { rootStyle } = useDashboardRuntimeBindings({
    instanceId,
    rootEl,
    scrollEl: contentEl,
    tooltipStore,
    apiClient: props.apiClient,
    onHostResize: clampSettingsPosInPlace,
  });

  // PanelEditorDrawer is heavy (query builder + editor helpers). Load it only after first open.
  const panelEditorDrawerLoaded = ref(false);
  watch(
    () => isDrawerOpen.value,
    (open) => {
      if (open) panelEditorDrawerLoaded.value = true;
    },
    { immediate: true }
  );

  // ---------------------------
  // 分页状态（按面板组隔离）
  // ---------------------------
  const {
    getPagedGroupById,
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
  // 聚焦层（打开单个组，不影响背景滚动位置）
  // ---------------------------
  const focusedGroupId = ref<PanelGroup['id'] | null>(null);
  const focusStartOffsetY = ref(0);
  const focusOpen = ref(false);

  const focusedPagedGroup = computed(() => {
    if (focusedGroupId.value == null) return null;
    return getPagedGroupById(focusedGroupId.value);
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
  // 默认打开策略：仅一个面板组时自动打开
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

  const handleAddPanelGroup = () => {
    if (!canEditDashboard.value) return;
    panelGroupDialogRef.value?.openCreate?.();
  };

  const handleCreateGroup = () => {
    handleAddPanelGroup();
  };

  const handleEditGroup = (group: PanelGroup) => {
    if (!canEditDashboard.value) return;
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

  // 注意：
  // 只读能力开关（readOnly）由 store/SDK 作为单一事实来源（SSOT），Dashboard 组件内部不再监听外部 props 触发业务。

  // ---------------------------
  // 乐观同步的反馈提示
  // ---------------------------
  // 自动同步失败时 store 会回滚到 syncedDashboard，这在 UI 上会表现为“刚改完又变回去了”。
  // 这里提供 toast 提示，避免误解为问题/丢数据。
  const lastErrorToastAt = ref(0);
  const lastErrorToastMessage = ref<string | null>(null);
  const ERROR_TOAST_COOLDOWN_MS = 2_500;

  watch(lastError, (err) => {
    if (!err) return;
    const now = Date.now();
    const isCooldown = now - lastErrorToastAt.value < ERROR_TOAST_COOLDOWN_MS;
    if (isCooldown && lastErrorToastMessage.value === err) return;
    lastErrorToastAt.value = now;
    lastErrorToastMessage.value = err;

    if (bootStage.value === 'error') {
      message.error(`仪表盘加载失败：${err}`);
      return;
    }

    // 手动保存失败：明确告诉用户（上层可能也会捕获 error，但不一定 toast）
    if (isSaving.value) {
      message.error(`保存失败：${err}`);
      return;
    }

    // 自动同步失败：提示已回滚到上一次成功版本
    if (isSyncing.value) {
      message.error(`同步失败，已回滚到上次保存版本：${err}`);
      return;
    }

    message.error(err);
  });

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
    if (dashboardId.value) parts.push(`dashboardId：${String(dashboardId.value)}`);
    if (typeof bootStats.value.groupCount === 'number') parts.push(`面板组：${bootStats.value.groupCount}`);
    if (typeof bootStats.value.panelCount === 'number') parts.push(`面板：${bootStats.value.panelCount}`);
    if (typeof bootStats.value.jsonBytes === 'number') {
      const mb = (bootStats.value.jsonBytes / 1024 / 1024).toFixed(2);
      parts.push(`JSON：${mb}MB`);
    }
    return parts.join(' / ');
  });

  type DashboardStatusKind = 'waiting' | 'loading' | 'error';
  const statusKind = computed<DashboardStatusKind | null>(() => {
    if (isBooting.value) return 'loading';
    if (currentDashboard.value) return null;
    if (bootStage.value === 'error') return 'error';
    // currentDashboard 为空且不在 boot：典型为宿主正在远程获取 dashboardId
    return 'waiting';
  });

  const statusTitle = computed(() => {
    switch (statusKind.value) {
      case 'loading':
        return bootTitle.value;
      case 'error':
        if (bootStats.value.source === 'import') return '导入失败';
        if (bootStats.value.source === 'remote') return '加载失败';
        return '初始化失败';
      case 'waiting':
        return '正在准备仪表盘...';
      default:
        return '';
    }
  });

  const statusDetail = computed(() => {
    switch (statusKind.value) {
      case 'loading':
        return bootDetail.value;
      case 'error': {
        const idText = dashboardId.value ? `dashboardId：${String(dashboardId.value)}` : '';
        const errText = lastError.value ? `错误：${String(lastError.value)}` : '错误：未知错误';
        const hint = '可稍后重试或导入 JSON';
        return idText ? `${idText} / ${errText}（${hint}）` : `${errText}（${hint}）`;
      }
      case 'waiting':
        return '等待宿主获取 dashboardId 并调用 loadDashboard(dashboardId) 后加载远端 JSON...';
      default:
        return '';
    }
  });

  const statusHint = computed(() => {
    if (statusKind.value === 'loading' && isLargeDashboard.value) {
      return '检测到数据量较大，首次加载可能需要更久，请耐心等待';
    }
    return '';
  });

  const statusIcon = computed(() => {
    switch (statusKind.value) {
      case 'error':
        return CloseCircleOutlined;
      case 'waiting':
        return ClockCircleOutlined;
      default:
        return ClockCircleOutlined;
    }
  });

  const handleStatusMaskWheel = (event: WheelEvent) => {
    event.preventDefault();
  };

  const handleStatusMaskTouchMove = (event: TouchEvent) => {
    event.preventDefault();
  };

  const {
    MAX_EDITABLE_DASHBOARD_JSON_CHARS,
    jsonModalVisible,
    jsonModalMode,
    dashboardJson,
    isJsonValid,
    isGeneratingJson,
    dashboardJsonEditorRef,
    jsonFileInputRef,
    lockScrollEl,
    lockScrollEnabled,
    openJsonModal,
    closeJsonModal,
    handleJsonValidate,
    handleJsonFileChange,
    handleImportJson,
    handleApplyJson,
  } = useDashboardJsonModal({
    isBooting,
    isReadOnly,
    isLargeDashboard,
    rootEl,
    contentEl,
    dashboardStore,
  });

  const toolbarApi = {
    // JSON 弹窗（SDK/外部可直接唤起，不依赖右侧设置抽屉）
    openJsonModal,
    closeJsonModal,

    // 核心动作（无界面也可执行）
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

    // JSON 导入/导出（导出可无界面；导入/查看/应用依赖工具条）
    exportJson: () => {
      if (isBooting.value) return;
      const dash = dashboardStore.getPersistableDashboardSnapshot();
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
    importJson: handleImportJson,
    viewJson: () => openJsonModal('view'),
    applyJson: handleApplyJson,

    // 受控辅助能力
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

    // 说明：浮层类组件不应被 `> * { position: relative }` 影响布局流，因此这里显式把聚焦层定位为 absolute。
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

    &__empty-hint {
      margin-top: var(--gf-space-2);
      font-size: 12px;
      line-height: 1.5;
      color: var(--gf-color-text-secondary);
    }

    &__empty-actions {
      margin-top: var(--gf-space-3);
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

      &.is-dragging {
        cursor: grabbing;

        .dp-dashboard__settings-btn {
          cursor: grabbing;
        }
      }
    }

    &__settings-btn.gf-button--icon-only {
      --gf-btn-icon-only-size: 44px;
      --gf-btn-bg: color-mix(in srgb, var(--gf-color-surface), transparent 6%);
      --gf-btn-bg-hover: color-mix(in srgb, var(--gf-color-surface), transparent 0%);
      --gf-btn-bg-active: color-mix(in srgb, var(--gf-color-surface), transparent 0%);
      --gf-btn-border: var(--gf-color-border-strong);
      --gf-btn-border-hover: var(--gf-color-border-strong);
      --gf-btn-shadow: var(--gf-shadow-2);
      --gf-btn-shadow-hover: var(--gf-shadow-2);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      cursor: grab;
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

    &__status-head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--gf-color-primary);
    }

    &__status-icon {
      font-size: 20px;
      line-height: 1;
      color: currentColor;

      &.is-error {
        color: var(--gf-color-danger, #ff4d4f);
      }
    }

    &__status-title {
      font-size: var(--gf-font-size-sm);
      font-weight: 650;
      color: currentColor;

      &.is-error {
        color: var(--gf-color-danger, #ff4d4f);
      }
    }
  }
</style>
