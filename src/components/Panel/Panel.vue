<template>
  <div v-if="panel" class="panel">
    <PanelHeader :group-id="groupId" :panel="panel" />
    <PanelContent :panel="panel" />
  </div>
  <div v-else class="panel panel-error">
    <a-result status="error" title="面板加载失败" sub-title="未找到面板数据" />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { ID } from '@/types';
  import { useDashboardStore } from '@/stores';
  import PanelHeader from './PanelHeader.vue';
  import PanelContent from './PanelContent.vue';

  const props = defineProps<{
    groupId: ID;
    panelId: ID;
  }>();

  const dashboardStore = useDashboardStore();

  const panel = computed(() => dashboardStore.getPanelById(props.groupId, props.panelId));
</script>

<style scoped lang="less">
  .panel {
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
  }

  .panel-error {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
