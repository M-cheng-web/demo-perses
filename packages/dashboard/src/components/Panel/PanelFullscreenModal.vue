<!-- 全屏查看面板 -->
<template>
  <Modal
    v-model:open="isOpen"
    :title="panelTitle"
    :width="'90%'"
    :footer="null"
    :lock-scroll="lockScrollEnabled"
    :lock-scroll-el="lockScrollEl"
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
  import type { Panel } from '@grafana-fast/types';
  import { useDashboardStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import { createNamespace } from '/#/utils';
  import PanelContent from './PanelContent.vue';
  import { Modal } from '@grafana-fast/component';

  const [_, bem] = createNamespace('panel-fullscreen-modal');

  const dashboardStore = useDashboardStore();
  const runtime = useDashboardRuntime();
  const lockScrollEl = computed(() => runtime.scrollEl?.value ?? runtime.rootEl?.value ?? null);
  const lockScrollEnabled = computed(() => lockScrollEl.value != null);

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

    :deep(.gf-modal__body) {
      display: flex;
      flex-direction: column;
    }
  }
</style>
