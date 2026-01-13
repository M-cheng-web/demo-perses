<template>
  <div v-if="panel" :class="bem()">
    <PanelHeader :group-id="groupId" :panel="panel" />
    <PanelContent :panel="panel" />
  </div>
  <div v-else :class="bem({ error: true })">
    <Result status="error" title="面板加载失败" sub-title="未找到面板数据" />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { ID } from '@grafana-fast/types';
  import { Result } from '@grafana-fast/component';
  import { useDashboardStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import PanelHeader from './PanelHeader.vue';
  import PanelContent from './PanelContent.vue';

  const [_, bem] = createNamespace('panel');

  const props = defineProps<{
    groupId: ID;
    panelId: ID;
  }>();

  const dashboardStore = useDashboardStore();

  const panel = computed(() => dashboardStore.getPanelById(props.groupId, props.panelId));
</script>

<style scoped lang="less">
  .dp-panel {
    --panel-hover: none;

    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--gf-color-surface);
    border: 1px solid var(--gf-color-border);
    border-radius: var(--gf-radius-md);
    overflow: hidden;
    transition:
      box-shadow var(--gf-motion-normal) var(--gf-easing),
      border-color var(--gf-motion-normal) var(--gf-easing);

    &:hover {
      --panel-hover: flex;
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
    }

    &--error {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
