<!--
  组件说明：面板网格布局（GridLayout）

  用途：
  - 基于 vue-grid-layout-v3 渲染面板布局（拖拽/缩放）
  - 在编辑模式下把 layout 变化同步回 Dashboard Store
-->
<template>
  <div :class="bem()">
    <VirtualList
      :scope-id="String(props.groupId)"
      :scroll-mode="props.scrollMode"
      :height="props.scrollHeight"
      :idle-ms="200"
      :row-height="30"
      :margin-y="10"
      :hot-overscan-screens="0.5"
      :keep-alive-count="keepAliveCount"
      :items="layoutItems"
      v-slot="{ dataList, renderList, isHydrated }"
    >
      <template v-if="dataList.length > 0">
        <grid-layout
          :layout="canEditLayout ? localLayout : dataList"
          :col-num="48"
          :row-height="30"
          :is-draggable="canEditLayout"
          :is-resizable="canEditLayout"
          :vertical-compact="true"
          :use-css-transforms="true"
          :margin="[10, 10]"
          @update:layout="handleGridLayoutModelUpdate"
          @layout-updated="handleLayoutUpdated"
        >
          <grid-item
            v-for="layoutItem in renderList"
            :key="layoutItem.i"
            :x="layoutItem.x"
            :y="layoutItem.y"
            :w="layoutItem.w"
            :h="layoutItem.h"
            :i="layoutItem.i"
            :min-w="layoutItem.minW || 6"
            :min-h="layoutItem.minH || 4"
            @move="handleUserInteracting"
            @resize="handleUserInteracting"
          >
            <Panel
              v-if="panelById.get(layoutItem.i as ID)"
              :title="panelById.get(layoutItem.i as ID)?.name"
              :description="panelById.get(layoutItem.i as ID)?.description"
              size="small"
              :hoverable="true"
              :body-padding="false"
            >
              <template v-if="isHydrated(layoutItem.i)" #right="{ hovered }">
                <PanelRightActions :group-id="groupId" :panel="panelById.get(layoutItem.i as ID)!" :hovered="hovered" />
              </template>

              <PanelContent v-if="isHydrated(layoutItem.i)" :panel="panelById.get(layoutItem.i as ID)!" />
              <div v-else :class="bem('panel-skeleton')">
                <Skeleton :active="true" height="100%" />
              </div>
            </Panel>

            <Panel v-else size="small" :hoverable="false" :body-padding="true" title="面板加载失败">
              <div :class="bem('panel-error')">
                <Alert type="error" show-icon message="面板加载失败" description="未找到面板数据" />
              </div>
            </Panel>
          </grid-item>
        </grid-layout>
      </template>

      <template v-else>
        <Empty description="暂无面板">
          <Button v-if="canEditLayout" type="primary" @click="handleAddPanel">添加面板</Button>
        </Empty>
      </template>
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { Alert, Button, Empty, Panel, Skeleton } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { GridLayout, GridItem } from 'vue-grid-layout-v3';
  import type { PanelLayout, Panel as PanelType, ID } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import PanelContent from '/#/components/Panel/PanelContent.vue';
  import PanelRightActions from '/#/components/Panel/PanelRightActions.vue';
  import { createNamespace, debounceCancellable } from '/#/utils';
  import VirtualList from './VirtualList.vue';

  const [_, bem] = createNamespace('grid-layout');

  const props = withDefaults(
    defineProps<{
      groupId: ID;
      panels: PanelType[];
      /**
       * 当前分页的 layout（仅包含当前页 panels）
       * 注意：这里的 y 已做过“页内 rebased”（从 0 开始），以避免出现巨大空白。
       */
      layout: PanelLayout[];
      /**
       * layout 的页内 y 偏移（用于把编辑后的 y 写回到 group 的全量 layout）
       * - 由上层按当前页的原始布局计算得到（通常为 minY）
       */
      layoutBaseY?: number;
      /**
       * VirtualList 的滚动容器来源
       * - runtime：使用 Dashboard 外层滚动容器（旧行为）
       * - self：当前页内容自身滚动（用于“单组固定高度 + 内部滚动条”）
       */
      scrollMode?: 'self' | 'runtime';
      /** scrollMode=self 时的固定高度（支持 number / '100%'） */
      scrollHeight?: number | string;
    }>(),
    { layoutBaseY: 0, scrollMode: 'runtime', scrollHeight: undefined }
  );

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { editingGroupId, viewMode, isBooting, isReadOnly } = storeToRefs(dashboardStore);

  const canEditLayout = computed(() => {
    if (isBooting.value) return false;
    if (isReadOnly.value) return false;
    if (viewMode.value === 'allPanels') return false;
    if (editingGroupId.value == null) return false;
    return String(editingGroupId.value) === String(props.groupId);
  });

  /**
   * 缓存策略（解决“滚远了再滚回来，ECharts 重新 init/重画”的体感问题）
   * - VirtualList 的 hydratedIds 只保证“不显示骨架”，不保证组件实例不被卸载
   * - keepAliveCount 通过 pinnedIds 让一定数量的面板保持渲染，避免频繁卸载/重建
   */
  const keepAliveCount = computed(() => {
    // 分页后单页最多 30 个，保持一个较小的缓存即可（避免 DOM/内存膨胀）
    return 60;
  });

  const layoutItems = computed<PanelLayout[]>(() => (canEditLayout.value ? localLayout.value : props.layout));

  const localLayout = ref<PanelLayout[]>([...props.layout]);
  const layoutBaseYRef = ref<number>(Math.max(0, Math.floor(props.layoutBaseY ?? 0)));

  // 监听 props.layout 变化
  watch(
    () => props.layout,
    (newLayout) => {
      // 若正在编辑且存在未提交的交互变更：在切换分页/外部替换 layout 前先落盘，避免 baseY 变化导致写回错误
      if (canEditLayout.value && hasPendingUserLayoutChange.value) {
        debouncedCommitLayout.flush();
      }

      layoutBaseYRef.value = Math.max(0, Math.floor(props.layoutBaseY ?? 0));
      // 编辑模式下：避免直接替换 array 引用导致 VirtualList 中的 dataList 引用失效
      // 使用 in-place 同步保持对象引用稳定（grid-item props 才能实时更新）
      if (canEditLayout.value) {
        handleLayoutModelUpdate(newLayout);
        return;
      }
      localLayout.value = [...newLayout];
    },
    { deep: true }
  );

  // 退出编辑态时：把 pending layout 变更强制落盘，避免“最后一次拖拽没保存到 store”
  watch(canEditLayout, (enabled) => {
    if (enabled) return;
    if (hasPendingUserLayoutChange.value) debouncedCommitLayout.flush();
  });

  const handleLayoutModelUpdate = (nextLayout: PanelLayout[]) => {
    const currentById = new Map<string, PanelLayout>();
    localLayout.value.forEach((it) => currentById.set(String(it.i), it));

    const nextRefs: PanelLayout[] = [];
    for (const next of nextLayout) {
      const id = String(next.i);
      const existing = currentById.get(id);
      if (existing) {
        Object.assign(existing, next);
        nextRefs.push(existing);
      } else {
        // 新增项：直接使用 next（或浅拷贝）即可
        nextRefs.push({ ...next });
      }
    }
    localLayout.value = nextRefs;
  };

  const handleGridLayoutModelUpdate = (nextLayout: PanelLayout[]) => {
    if (!canEditLayout.value) return;
    handleLayoutModelUpdate(nextLayout);
  };

  const panelById = computed(() => {
    const map = new Map<ID, PanelType>();
    for (const p of props.panels) map.set(p.id, p);
    return map;
  });

  /**
   * 性能优化：
   * - grid layout 在 dragmove/resizemove 过程中可能会频繁 emit layout-updated（包含全量 layout）
   * - 如果每次都写回 pinia，会导致大组（1000 条）编辑时明显卡顿
   *
   * 这里的策略：
   * - UI 内部仍用 v-model:layout 实时更新 localLayout
   * - 使用 debounce 合并写回：交互停止一小段时间后再提交最终 layout
   */
  const hasPendingUserLayoutChange = ref(false);

  const handleUserInteracting = () => {
    if (!canEditLayout.value) return;
    hasPendingUserLayoutChange.value = true;
  };

  const commitLayoutToStore = () => {
    if (!hasPendingUserLayoutChange.value) return;
    // 分页模式：只允许编辑当前页，把当前页 layout 回写到 group 的全量 layout（按 i merge）。
    const baseY = Math.max(0, Math.floor(layoutBaseYRef.value ?? 0));
    const patched: PanelLayout[] = localLayout.value.map((it) => ({
      ...it,
      y: Math.max(0, Number(it.y ?? 0) + baseY),
    }));
    dashboardStore.patchPanelGroupLayoutItems(props.groupId, patched);
    hasPendingUserLayoutChange.value = false;
  };

  // 注意：这里的延迟不是“请求延迟”，只用于减少 pinia 的高频写入压力
  const debouncedCommitLayout = debounceCancellable(commitLayoutToStore, 220);

  const handleLayoutUpdated = () => {
    if (!hasPendingUserLayoutChange.value) return;
    // 重要：大组编辑时 grid-layout 可能只渲染了 dataList 子集，
    // layout-updated 回调可能只包含子集；这里统一提交 localLayout（全量）。
    debouncedCommitLayout();
  };

  const handleAddPanel = () => {
    if (!canEditLayout.value) return;
    editorStore.openCreateEditor(props.groupId);
  };

  onBeforeUnmount(() => {
    // 避免组件卸载后仍触发回调
    debouncedCommitLayout.flush();
  });
</script>

<style scoped lang="less">
  .dp-grid-layout {
    min-height: 200px;
    height: 100%;

    &__panel-error {
      height: 100%;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }

    &__panel-skeleton {
      height: 100%;
      padding: 12px;
    }
  }
</style>
