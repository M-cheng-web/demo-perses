<template>
  <div class="dashboard">
    <!-- 工具栏 -->
    <DashboardToolbar />

    <!-- 面板组列表 -->
    <div class="dashboard-content">
      <a-empty v-if="!panelGroups.length" description="暂无面板组">
        <a-button v-if="isEditMode" type="primary" @click="handleAddPanelGroup"> 创建面板组 </a-button>
      </a-empty>

      <PanelGroupList v-else :panel-groups="panelGroups" />
    </div>

    <!-- 面板编辑器 -->
    <PanelEditorDrawer />

    <!-- 全屏查看面板 -->
    <PanelFullscreenModal ref="fullscreenModalRef" />

    <!-- 全局唯一的 Tooltip -->
    <GlobalChartTooltip />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useDashboardStore, useTooltipStore } from '@/stores';
  import DashboardToolbar from './DashboardToolbar.vue';
  import PanelGroupList from '@/components/PanelGroup/PanelGroupList.vue';
  import PanelEditorDrawer from '@/components/PanelEditor/PanelEditorDrawer.vue';
  import PanelFullscreenModal from '@/components/Panel/PanelFullscreenModal.vue';
  import GlobalChartTooltip from '@/components/ChartTooltip/GlobalChartTooltip.vue';

  const dashboardStore = useDashboardStore();
  const tooltipStore = useTooltipStore();
  const { panelGroups, isEditMode, viewPanel } = storeToRefs(dashboardStore);
  const fullscreenModalRef = ref<InstanceType<typeof PanelFullscreenModal>>();

  const handleAddPanelGroup = () => {
    dashboardStore.addPanelGroup({ title: '新面板组' });
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
  .dashboard {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: @background-light;
  }

  .dashboard-content {
    flex: 1;
    overflow: auto;
    padding: @spacing-md;
  }
</style>
