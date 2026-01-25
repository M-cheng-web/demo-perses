<!--
  文件说明：Dashboard 根组件

  职责：
  - 提供运行时依赖（apiClient / runtimeContext）
  - 渲染工具栏、面板组、编辑器、全屏弹窗、全局 Tooltip 等
  - 处理多实例隔离：鼠标跟踪、依赖注入与 pinia 附加依赖绑定
-->
<template>
  <ConfigProvider :theme="props.theme">
    <div ref="rootEl" :class="bem()">
      <!-- 工具栏 -->
      <DashboardToolbar />

      <!-- 面板组列表 -->
      <div ref="contentEl" :class="bem('content')">
        <Empty v-if="!panelGroups.length" :description="emptyText">
          <Button v-if="isEditMode" type="primary" @click="handleAddPanelGroup"> 创建面板组 </Button>
        </Empty>

        <PanelGroupList v-else :panel-groups="panelGroups" @edit-group="handleEditGroup" />
      </div>

      <!-- 面板编辑器 -->
      <PanelEditorDrawer />

      <!-- 全屏查看面板 -->
      <PanelFullscreenModal ref="fullscreenModalRef" />

      <!-- 全局唯一的 Tooltip -->
      <GlobalChartTooltip />

      <!-- 全局面板组编辑对话框 -->
      <PanelGroupDialog ref="panelGroupDialogRef" />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted, computed, provide, inject } from 'vue';
  import { getActivePinia, storeToRefs, type Pinia } from '@grafana-fast/store';
  import { Button, ConfigProvider, Empty } from '@grafana-fast/component';
  import { useDashboardStore, useTooltipStore, useVariablesStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import { DASHBOARD_EMPTY_TEXT } from '/#/components/Dashboard/utils';
  import DashboardToolbar from './DashboardToolbar.vue';
  import PanelGroupList from '/#/components/PanelGroup/PanelGroupList.vue';
  import PanelEditorDrawer from '/#/components/PanelEditor/PanelEditorDrawer.vue';
  import PanelFullscreenModal from '/#/components/Panel/PanelFullscreenModal.vue';
  import GlobalChartTooltip from '/#/components/ChartTooltip/GlobalChartTooltip.vue';
  import PanelGroupDialog from '/#/components/PanelGroup/PanelGroupDialog.vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import type { GrafanaFastApiClient } from '@grafana-fast/api';
  import { createMockApiClient } from '@grafana-fast/api';
  import { createPrefixedId } from '@grafana-fast/utils';
  import { GF_API_KEY, GF_RUNTIME_KEY } from '/#/runtime/keys';
  import { setPiniaApiClient } from '/#/runtime/piniaAttachments';

  const [_, bem] = createNamespace('dashboard');

  const props = withDefaults(
    defineProps<{
      /**
       * Theme used by the embedded dashboard root.
       * - 'inherit': follow document / parent tokens (recommended for host apps)
       * - 'light'/'blue': explicit light scheme
       * - 'dark': explicit dark scheme
       */
      theme?: 'blue' | 'light' | 'dark' | 'inherit';
      /**
       * Optional runtime-provided API client (contracts + implementation).
       * When not provided, dashboard defaults to mock implementation.
       */
      apiClient?: GrafanaFastApiClient;
      /**
       * Optional runtime id for multi-instance isolation.
       * When not provided, a random id is generated.
       */
      runtimeId?: string;
    }>(),
    {
      theme: 'inherit',
      apiClient: undefined,
      runtimeId: undefined,
    }
  );

  const dashboardStore = useDashboardStore();
  const tooltipStore = useTooltipStore();
  const variablesStore = useVariablesStore();
  const { panelGroups, isEditMode, viewPanel } = storeToRefs(dashboardStore);
  const { currentDashboard } = storeToRefs(dashboardStore);
  const fullscreenModalRef = ref<InstanceType<typeof PanelFullscreenModal>>();
  const panelGroupDialogRef = ref<InstanceType<typeof PanelGroupDialog>>();
  const rootEl = ref<HTMLElement | null>(null);
  const contentEl = ref<HTMLElement | null>(null);

  const emptyText = computed(() => DASHBOARD_EMPTY_TEXT);

  const runtimeId = computed(() => props.runtimeId ?? createPrefixedId('rt'));

  // Provide runtime-scoped dependencies
  const apiClient = computed(() => props.apiClient ?? createMockApiClient());
  provide(GF_API_KEY, apiClient.value);
  provide(GF_RUNTIME_KEY, { id: runtimeId.value, rootEl, scrollEl: contentEl });

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
    dashboardStore.addPanelGroup({ title: '新面板组' });
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
  });

  onUnmounted(() => {
    unbindPointerTracking(rootEl.value);
  });

  // root element changes (unlikely) -> rebind
  watch(
    rootEl,
    (el, prev) => {
      unbindPointerTracking(prev ?? null);
      bindPointerTracking(el ?? null);
    },
    { immediate: false }
  );

  // Sync variables store from the current dashboard (import/load)
  watch(
    currentDashboard,
    (d) => {
      variablesStore.initializeFromDashboard(d ?? null);
    },
    { immediate: true }
  );
</script>

<style scoped lang="less">
  @import '/#/assets/styles/variables.less';

  .dp-dashboard {
    // Visual tuning; host apps can override these CSS vars on the mount container.
    --gf-dashboard-grid-size: 28px;
    --gf-dashboard-grid-opacity: 0.32;

    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: @background-light;
    background-image:
      linear-gradient(180deg, var(--gf-bg-haze-top, rgba(255, 255, 255, 0.22)), transparent 45%),
      radial-gradient(1200px circle at 12% -18%, var(--gf-bg-glow-1, rgba(59, 130, 246, 0.12)), transparent 58%),
      radial-gradient(900px circle at 90% -12%, var(--gf-bg-glow-2, rgba(34, 197, 94, 0.1)), transparent 55%),
      radial-gradient(800px circle at 50% 115%, var(--gf-bg-glow-3, rgba(245, 158, 11, 0.08)), transparent 60%);
    background-attachment: fixed;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(to right, var(--gf-bg-grid-line, rgba(148, 163, 184, 0.18)) 1px, transparent 1px),
        linear-gradient(to bottom, var(--gf-bg-grid-line, rgba(148, 163, 184, 0.18)) 1px, transparent 1px),
        linear-gradient(to right, var(--gf-bg-grid-line, rgba(148, 163, 184, 0.18)) 1px, transparent 1px),
        linear-gradient(to bottom, var(--gf-bg-grid-line, rgba(148, 163, 184, 0.18)) 1px, transparent 1px);
      background-size:
        var(--gf-dashboard-grid-size) var(--gf-dashboard-grid-size),
        var(--gf-dashboard-grid-size) var(--gf-dashboard-grid-size),
        calc(var(--gf-dashboard-grid-size) * 4) calc(var(--gf-dashboard-grid-size) * 4),
        calc(var(--gf-dashboard-grid-size) * 4) calc(var(--gf-dashboard-grid-size) * 4);
      background-position: 0 0;
      opacity: var(--gf-dashboard-grid-opacity);
      pointer-events: none;
      z-index: 0;
      -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0) 70%);
      mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0) 70%);
    }

    > * {
      position: relative;
      z-index: 1;
    }

    &__content {
      flex: 1;
      overflow: auto;
      padding: 14px 16px 18px;

      // Keep the layout breathable on large screens
      > * {
        width: 100%;
        max-width: 1480px;
        margin: 0 auto;
      }
    }
  }
</style>
