<template>
  <Panel v-if="panel" :title="panel.name" :description="panel.description" size="small" :hoverable="true" :body-padding="false">
    <template #right="{ hovered }">
      <PanelRightActions :group-id="groupId" :panel="panel" :hovered="hovered" />
    </template>

    <PanelContent :panel="panel" />
  </Panel>

  <Panel v-else size="small" :hoverable="false" :body-padding="true" title="面板加载失败">
    <div :class="bem('error')">
      <Alert type="error" show-icon message="面板加载失败" description="未找到面板数据" />
    </div>
  </Panel>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { ID } from '@grafana-fast/types';
  import { Alert, Panel } from '@grafana-fast/component';
  import { useDashboardStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import PanelContent from './PanelContent.vue';
  import PanelRightActions from './PanelRightActions.vue';

  const [_, bem] = createNamespace('panel');

  const props = defineProps<{
    groupId: ID;
    panelId: ID;
  }>();

  const dashboardStore = useDashboardStore();

  const panel = computed(() => dashboardStore.getPanelById(props.groupId, props.panelId));
</script>

<style scoped lang="less">
  .dp-panel__error {
    height: 100%;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
</style>
