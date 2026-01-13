<template>
  <Panel
    :title="group.title || '未命名面板组'"
    :description="group.description"
    size="large"
    :collapsible="true"
    :collapsed="group.isCollapsed"
    :hoverable="true"
    :body-padding="true"
    @update:collapsed="handleCollapsedChange"
  >
    <template #right>
      <PanelGroupRightActions v-if="isEditMode" :group="group" :index="index" :is-last="isLast" @edit="$emit('edit', group)" />
    </template>

    <GridLayout :group-id="group.id" :panels="group.panels" :layout="group.layout" />
  </Panel>
</template>

<script setup lang="ts">
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';
  import { Panel } from '@grafana-fast/component';
  import { useDashboardStore } from '/#/stores';
  import GridLayout from '/#/components/GridLayout/GridLayout.vue';
  import PanelGroupRightActions from './PanelGroupRightActions.vue';

  const props = defineProps<{
    group: PanelGroup;
    index: number;
    isLast?: boolean;
  }>();

  const _emit = defineEmits<{
    (e: 'edit', group: PanelGroup): void;
  }>();

  const dashboardStore = useDashboardStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const handleCollapsedChange = (collapsed: boolean) => {
    dashboardStore.updatePanelGroup(props.group.id, { isCollapsed: collapsed });
  };
</script>
