<!-- 全屏查看面板 -->
<template>
  <Modal
    v-model:open="isOpen"
    :title="panelTitle"
    :width="'90%'"
    :footer="null"
    :body-style="{ padding: 0, height: '80vh' }"
    :class="bem()"
    centered
    @cancel="handleClose"
  >
    <div :class="bem('content')">
      <PanelContent v-if="currentPanel" :panel="currentPanel" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import type { Panel } from '@/types';
  import { useDashboardStore } from '@/stores';
  import { createNamespace } from '@/utils';
  import PanelContent from './PanelContent.vue';
  import { Modal } from 'ant-design-vue';

  const [_, bem] = createNamespace('panel-fullscreen-modal');

  const dashboardStore = useDashboardStore();

  const isOpen = ref(false);
  const currentPanel = ref<Panel>();

  const panelTitle = computed(() => currentPanel.value?.name || '面板详情');

  const open = (panel: Panel) => {
    currentPanel.value = panel;
    isOpen.value = true;
  };

  const handleClose = () => {
    isOpen.value = false;
    currentPanel.value = undefined;
    // 清除 viewPanelId
    dashboardStore.setViewPanel(null, null);
  };

  defineExpose({
    open,
  });
</script>

<style scoped lang="less">
  .dp-panel-fullscreen-modal {
    &__content {
      width: 100%;
      height: 80vh;
      padding: @spacing-md;
      overflow: auto;
    }

    :deep(.ant-modal-body) {
      display: flex;
      flex-direction: column;
    }
  }
</style>
