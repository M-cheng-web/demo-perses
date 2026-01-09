<template>
  <div :class="bem()">
    <grid-layout
      v-if="layout.length > 0"
      v-model:layout="localLayout"
      :col-num="48"
      :row-height="30"
      :is-draggable="isEditMode"
      :is-resizable="isEditMode"
      :vertical-compact="true"
      :use-css-transforms="true"
      :margin="[10, 10]"
      @layout-updated="handleLayoutChange"
    >
      <grid-item
        v-for="item in localLayout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        :min-w="item.minW || 6"
        :min-h="item.minH || 4"
      >
        <Panel :group-id="groupId" :panel-id="item.i" />
      </grid-item>
    </grid-layout>

    <Empty v-else description="暂无面板">
      <Button v-if="isEditMode" type="primary" @click="handleAddPanel">添加面板</Button>
    </Empty>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Empty, Button } from 'ant-design-vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { GridLayout, GridItem } from 'vue-grid-layout-v3';
  import type { PanelLayout, Panel as PanelType, ID } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import Panel from '/#/components/Panel/Panel.vue';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('grid-layout');

  const props = defineProps<{
    groupId: ID;
    panels: PanelType[];
    layout: PanelLayout[];
  }>();

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const localLayout = ref<PanelLayout[]>([...props.layout]);

  // 监听 props.layout 变化
  watch(
    () => props.layout,
    (newLayout) => {
      localLayout.value = [...newLayout];
    },
    { deep: true }
  );

  const handleLayoutChange = (newLayout: PanelLayout[]) => {
    dashboardStore.updatePanelGroupLayout(props.groupId, newLayout);
  };

  const handleAddPanel = () => {
    editorStore.openCreateEditor(props.groupId);
  };
</script>

<style scoped lang="less">
  .dp-grid-layout {
    min-height: 200px;
  }
</style>
