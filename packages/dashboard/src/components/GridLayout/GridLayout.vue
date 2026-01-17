<!--
  组件说明：面板网格布局（GridLayout）

  用途：
  - 基于 vue-grid-layout-v3 渲染面板布局（拖拽/缩放）
  - 在编辑模式下把 layout 变化同步回 Dashboard Store
-->
<template>
  <div ref="containerRef" :class="bem()" :style="{ minHeight: hasPaging ? `${containerHeightPx}px` : undefined }">
    <div v-if="hasPaging" :class="bem('meta')">
      <span :class="bem('meta-text')">分页查看（每页 {{ pageSize }} 条，共 {{ totalCount }} 条）</span>
      <Pagination
        v-model:current="page"
        v-model:pageSize="pageSize"
        :total="totalCount"
        :show-size-changer="true"
        :page-size-options="['20', '50', '100']"
      />
    </div>

    <grid-layout
      v-if="layout.length > 0"
      v-model:layout="gridLayoutModel"
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
        v-for="item in renderedLayout"
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
  import { computed, ref, watch } from 'vue';
  import { Empty, Button, Pagination } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { GridLayout, GridItem } from 'vue-grid-layout-v3';
  import type { PanelLayout, Panel as PanelType, ID } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import Panel from '/#/components/Panel/Panel.vue';
  import { createNamespace } from '/#/utils';
  import { useVirtualizedGridPanels } from '/#/composables/useVirtualizedGridPanels';

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
  const containerRef = ref<HTMLElement | null>(null);

  // 监听 props.layout 变化
  watch(
    () => props.layout,
    (newLayout) => {
      localLayout.value = [...newLayout];
    },
    { deep: true }
  );

  const { hasPaging, totalCount, page, pageSize, containerHeightPx, renderedLayout } = useVirtualizedGridPanels({
    scopeId: String(props.groupId),
    layout: localLayout,
    rowHeight: 30,
    marginY: 10,
    pageSize: 20,
    overscanScreens: 0.5,
    enabled: computed(() => !isEditMode.value),
    containerRef,
  });

  /**
   * view 模式下，GridLayout 接收的是“分页后的 layout”（y 已做 rebased），否则会：
   * - 触发巨大的空白滚动区域
   * - 触发 grid-layout-v3 的 layout-updated 回调，从而污染 store
   */
  const gridLayoutModel = computed<PanelLayout[]>({
    get: () => (isEditMode.value ? localLayout.value : renderedLayout.value),
    set: (next) => {
      if (!isEditMode.value) return;
      localLayout.value = next;
    },
  });

  const handleLayoutChange = (newLayout: PanelLayout[]) => {
    if (!isEditMode.value) return;
    dashboardStore.updatePanelGroupLayout(props.groupId, newLayout);
  };

  const handleAddPanel = () => {
    editorStore.openCreateEditor(props.groupId);
  };
</script>

<style scoped lang="less">
  .dp-grid-layout {
    min-height: 200px;

    &__meta {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px 10px;
      color: var(--gf-color-text-secondary);
      font-size: 12px;
    }

    &__meta-text {
      flex: 1;
      min-width: 0;
    }
  }
</style>
