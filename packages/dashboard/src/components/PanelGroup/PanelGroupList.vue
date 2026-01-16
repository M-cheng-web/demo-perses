<!--
  组件说明：面板组列表（PanelGroupList）

  用途：
  - 循环渲染 dashboard 的 panelGroups
  - 每个 group 内部挂载 GridLayout（渲染 panels）与右侧操作区
-->
<template>
  <div :class="bem()">
    <Panel
      v-for="(group, index) in panelGroups"
      :key="group.id"
      :title="group.title || '未命名面板组'"
      :description="group.description"
      size="large"
      :collapsible="true"
      :collapsed="group.isCollapsed"
      :hoverable="true"
      :body-padding="true"
      @update:collapsed="(collapsed) => handleCollapsedChange(group.id, collapsed)"
    >
      <template #right>
        <PanelGroupRightActions
          v-if="isEditMode"
          :group="group"
          :index="index"
          :is-last="index === panelGroups.length - 1"
          @edit="() => handleEditGroup(group)"
        />
      </template>

      <GridLayout :group-id="group.id" :panels="group.panels" :layout="group.layout" />
    </Panel>
  </div>
</template>

<script setup lang="ts">
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';
  import { Panel } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';
  import { useDashboardStore } from '/#/stores';
  import GridLayout from '/#/components/GridLayout/GridLayout.vue';
  import PanelGroupRightActions from './PanelGroupRightActions.vue';

  const [_, bem] = createNamespace('panel-group-list');

  defineProps<{
    panelGroups: PanelGroup[];
  }>();

  const emit = defineEmits<{
    (e: 'edit-group', group: PanelGroup): void;
  }>();

  const dashboardStore = useDashboardStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const handleEditGroup = (group: PanelGroup) => {
    emit('edit-group', group);
  };

  const handleCollapsedChange = (groupId: PanelGroup['id'], collapsed: boolean) => {
    dashboardStore.updatePanelGroup(groupId, { isCollapsed: collapsed });
  };
</script>

<style scoped lang="less">
  .dp-panel-group-list {
    display: flex;
    flex-direction: column;
    gap: @spacing-md;
  }
</style>
