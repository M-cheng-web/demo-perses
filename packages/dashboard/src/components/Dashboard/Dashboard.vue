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
          :api-mode="props.apiMode"
          :api-mode-options="props.apiModeOptions"
          :api-mode-switching="props.apiModeSwitching"
          @create-group="handleCreateGroup"
          @view-json="() => openJsonModal('view')"
          @import-json="handleImportJson"
          @export-json="toolbarApi.exportJson"
          @api-mode-change="handleApiModeChange"
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
          v-model="dashboardJson"
          :read-only="true"
          :max-editable-chars="MAX_DASHBOARD_JSON_CHARS_FOR_FAST_VIEW"
        />
        <template #footer>
          <Space>
            <Button @click="jsonModalVisible = false">关闭</Button>
            <Button
              v-if="jsonModalMode === 'import'"
              type="primary"
              :disabled="isReadOnly || isBooting || isApplyingJson"
              :loading="isApplyingJson"
              @click="handleApplyJson"
            >
              应用
            </Button>
          </Space>
        </template>
      </Modal>

      <!-- 隐藏的文件输入：用于导入 JSON（不依赖 toolbar/drawer） -->
      <input ref="jsonFileInputRef" type="file" accept=".json" style="display: none" @change="handleJsonFileChange" />

      <!-- 全局 Loading Mask：boot 阶段锁住交互（禁止滚动/折叠/点击） -->
      <Transition name="gf-boot-fade">
        <div v-if="statusKind != null" :class="bem('boot-mask')" @wheel="handleStatusMaskWheel" @touchmove="handleStatusMaskTouchMove">
          <div :class="bem('boot-card')">
            <div :class="bem('status-head')">
              <!-- waiting 和 loading 都使用 spinner，保持连续性 -->
              <div v-if="statusKind === 'loading' || statusKind === 'waiting'" :class="bem('status-spinner')">
                <div :class="bem('spinner-ring')"></div>
              </div>
              <component v-else :is="statusIcon" :class="[bem('status-icon'), `is-${statusKind}`]" />
              <div :class="[bem('status-title'), `is-${statusKind}`]">{{ statusTitle }}</div>
            </div>
            <div :class="bem('boot-detail')">{{ statusDetail }}</div>
            <div v-if="statusHint" :class="bem('boot-hint')">{{ statusHint }}</div>
            <!-- waiting 和 loading 都显示进度条，保持连续性 -->
            <div v-if="statusKind === 'loading' || statusKind === 'waiting'" :class="bem('boot-progress')">
              <div :class="bem('progress-bar')"></div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ref, watch, computed, defineAsyncComponent, h } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, ConfigProvider, Drawer, Empty, Modal, Space, message } from '@grafana-fast/component';
  import { SettingOutlined } from '@ant-design/icons-vue';
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
  import { usePanelGroupPagination } from '/#/composables/usePanelGroupPagination';
  import { useDashboardJsonModal } from './useDashboardJsonModal';
  import { useDashboardRuntimeBindings } from './useDashboardRuntimeBindings';
  import { useDashboardSettingsUi } from './useDashboardSettingsUi';
  import { useDashboardStatus } from './useDashboardStatus';

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
       *
       * 说明：
       * - 推荐由 SDK（useDashboardSdk）通过 piniaAttachments 注入（SSOT）
       * - 若缺失，load/save/query 等会在运行时抛错（不再默认回退 mock）
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
      /**
       * （可选）当前 API 模式：remote/mock
       * - 仅用于“本地开发/演示”时在全局设置中切换
       */
      apiMode?: 'remote' | 'mock';
      /**
       * （可选）API 模式可选项
       * - 未提供则不展示“数据源模式”卡片
       */
      apiModeOptions?: Array<{ label: string; value: 'remote' | 'mock'; disabled?: boolean }>;
      /** 切换中：用于禁用控件，避免重复触发 */
      apiModeSwitching?: boolean;
      /**
       * （可选）请求切换 API 模式
       * - 由 SDK/宿主实现（通常会重绑 apiClient 并触发 remount）
       */
      onRequestApiModeChange?: (mode: 'remote' | 'mock') => void | Promise<void>;
    }>(),
    {
      theme: 'light',
      portalTarget: null,
      apiClient: undefined,
      panelGroupFocusMotionMs: 200,
      apiMode: undefined,
      apiModeOptions: undefined,
      apiModeSwitching: false,
      onRequestApiModeChange: undefined,
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
    uiPageJumpRequest,
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

  const handleApiModeChange = (mode: 'remote' | 'mock') => {
    if (props.apiModeSwitching) return;
    const handler = props.onRequestApiModeChange;
    if (!handler) return;
    try {
      const ret = handler(mode);
      if (ret && typeof (ret as PromiseLike<void>).then === 'function') {
        void Promise.resolve(ret).catch((error) => {
          const msg = error instanceof Error ? error.message : '切换数据源模式失败';
          message.error(msg);
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '切换数据源模式失败';
      message.error(msg);
    }
  };

  // PanelEditorDrawer is heavy (query builder + editor helpers).
  // Strategy:
  // - Do not block the first render/booting stage
  // - Once dashboard is ready (booting finished), mount it in the background (idle/next tick)
  // - Also ensure it's mounted if something tries to open it
  const panelEditorDrawerLoaded = ref(false);

  const requestLoadPanelEditorDrawer = () => {
    if (panelEditorDrawerLoaded.value) return;
    panelEditorDrawerLoaded.value = true;
  };

  const scheduleLoadPanelEditorDrawer = () => {
    if (panelEditorDrawerLoaded.value) return;
    // Defer to idle time so the main dashboard UI can paint first.
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof w?.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => requestLoadPanelEditorDrawer(), { timeout: 800 });
      return;
    }
    window.setTimeout(() => requestLoadPanelEditorDrawer(), 0);
  };

  watch(
    () => isDrawerOpen.value,
    (open) => {
      if (open) requestLoadPanelEditorDrawer();
    },
    { immediate: true }
  );

  watch(
    () => isBooting.value,
    (booting) => {
      if (booting) return;
      scheduleLoadPanelEditorDrawer();
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
    pageSizeOptions: [20],
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

  const setPageSize = (groupId: PanelGroup['id']) => {
    if (isEditingActive.value) editorStore.closeEditor();
    // 产品要求：固定 20 条/页，不允许修改 pageSize
    baseSetPageSize(groupId, 20);
  };

  // store 发起的“跳页请求”（例如创建面板后跳到最后一页展示新面板）
  watch(uiPageJumpRequest, (req) => {
    if (!req) return;
    baseSetCurrentPage(req.groupId, req.page);
    dashboardStore.consumePanelGroupPageJump(req.nonce);
  });

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

  const { statusKind, statusTitle, statusDetail, statusHint, statusIcon, handleStatusMaskWheel, handleStatusMaskTouchMove } = useDashboardStatus({
    dashboardId,
    currentDashboard,
    isBooting,
    bootStage,
    bootStats,
    isLargeDashboard,
    isSaving,
    isSyncing,
    lastError,
  });

  const jsonFileInputRef = ref<HTMLInputElement>();

  const {
    MAX_DASHBOARD_JSON_CHARS_FOR_FAST_VIEW,
    jsonModalVisible,
    jsonModalMode,
    dashboardJson,
    isGeneratingJson,
    isApplyingJson,
    lockScrollEl,
    lockScrollEnabled,
    openJsonModal,
    closeJsonModal,
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
    jsonFileInputRef,
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
      void dashboardStore.addPanelGroup({ title: '新面板组', description: '' }).catch((error) => {
        const msg = error instanceof Error ? error.message : '创建面板组失败';
        message.error(msg);
      });
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
      background: linear-gradient(135deg, var(--gf-color-surface) 0%, var(--gf-color-surface-muted) 100%);
      cursor: progress;
    }

    &__boot-card {
      width: min(480px, 100%);
      padding: 24px;
      border-radius: var(--gf-radius-lg);
      border: 1px solid var(--gf-color-border);
      background: var(--gf-color-bg-elevated);
      box-shadow: var(--gf-shadow-3);
      animation: gf-card-float 0.4s var(--gf-easing-out) backwards;
    }

    &__boot-detail {
      margin-top: 12px;
      font-size: 13px;
      color: var(--gf-color-text-secondary);
      line-height: 1.6;
      word-break: break-word;
    }

    &__boot-hint {
      margin-top: 10px;
      font-size: 12px;
      color: var(--gf-color-warning-text, var(--gf-color-text-tertiary));
      line-height: 1.5;
    }

    &__boot-progress {
      margin-top: 16px;
      height: 3px;
      border-radius: 2px;
      background: var(--gf-color-fill-secondary);
      overflow: hidden;
    }

    &__progress-bar {
      height: 100%;
      width: 30%;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--gf-color-primary) 0%, var(--gf-color-primary-hover) 100%);
      animation: gf-progress-indeterminate 1.5s var(--gf-easing) infinite;
    }

    &__status-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    &__status-spinner {
      position: relative;
      width: 24px;
      height: 24px;
    }

    &__spinner-ring {
      position: absolute;
      inset: 0;
      border: 2.5px solid var(--gf-color-fill-tertiary);
      border-top-color: var(--gf-color-primary);
      border-radius: 50%;
      animation: gf-spin 0.9s linear infinite;
    }

    &__status-icon {
      font-size: 22px;
      line-height: 1;

      &.is-error {
        color: var(--gf-color-danger);
      }

      &.is-waiting {
        color: var(--gf-color-primary);
      }
    }

    &__status-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--gf-color-text-heading);

      &.is-loading {
        color: var(--gf-color-primary);
      }

      &.is-error {
        color: var(--gf-color-danger);
      }

      &.is-waiting {
        color: var(--gf-color-primary);
      }
    }
  }

  // ===== 动画定义 =====
  @keyframes gf-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes gf-progress-indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }

  @keyframes gf-card-float {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  // ===== Boot Fade 过渡 =====
  .gf-boot-fade-enter-active {
    transition: opacity 0.3s var(--gf-easing);
  }

  .gf-boot-fade-leave-active {
    transition: opacity 0.5s var(--gf-easing);
  }

  .gf-boot-fade-enter-from,
  .gf-boot-fade-leave-to {
    opacity: 0;
  }
</style>
