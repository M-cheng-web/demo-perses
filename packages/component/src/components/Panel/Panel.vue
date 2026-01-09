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
  import { Result } from 'ant-design-vue';
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
    background-color: @background-base;
    border: 1px solid @border-color;
    border-radius: @border-radius;
    overflow: hidden;
    transition: box-shadow 0.2s;

    &:hover {
      --panel-hover: flex;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &--error {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
