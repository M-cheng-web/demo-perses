<template>
  <ConfigProvider theme="blue">
    <div :class="bem()">
      <!-- 工具栏 -->
      <DashboardToolbar />

      <!-- 面板组列表 -->
      <div :class="bem('content')">
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
  import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, ConfigProvider, Empty } from '@grafana-fast/component';
  import { useDashboardStore, useTooltipStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import { DASHBOARD_EMPTY_TEXT, formatDashboardTitle } from '/#/components/Dashboard/utils';
  import DashboardToolbar from './DashboardToolbar.vue';
  import PanelGroupList from '/#/components/PanelGroup/PanelGroupList.vue';
  import PanelEditorDrawer from '/#/components/PanelEditor/PanelEditorDrawer.vue';
  import PanelFullscreenModal from '/#/components/Panel/PanelFullscreenModal.vue';
  import GlobalChartTooltip from '/#/components/ChartTooltip/GlobalChartTooltip.vue';
  import PanelGroupDialog from '/#/components/PanelGroup/PanelGroupDialog.vue';
  import type { PanelGroup } from '@grafana-fast/types';

  const [_, bem] = createNamespace('dashboard');

  const dashboardStore = useDashboardStore();
  const tooltipStore = useTooltipStore();
  const { panelGroups, isEditMode, viewPanel } = storeToRefs(dashboardStore);
  const fullscreenModalRef = ref<InstanceType<typeof PanelFullscreenModal>>();
  const panelGroupDialogRef = ref<InstanceType<typeof PanelGroupDialog>>();

  const emptyText = computed(() => DASHBOARD_EMPTY_TEXT);

  const _dashboardName = computed(() => formatDashboardTitle(dashboardStore.currentDashboard?.name));

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

  // 生命周期钩子
  onMounted(() => {
    // 监听整个 dashboard 的鼠标移动
    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
  });

  onUnmounted(() => {
    // 清理事件监听
    window.removeEventListener('mousemove', handleGlobalMouseMove);
  });
</script>

<style scoped lang="less">
  .dp-dashboard {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: @background-light;

    &__content {
      flex: 1;
      overflow: auto;
      padding: @spacing-md;
    }
  }
</style>
