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
      scroll-mode="runtime"
      :page-size="PAGE_SIZE_VIEW_MAX"
      :query="queryList"
      :threshold-px="BOTTOM_THRESHOLD_PX"
      :idle-ms="200"
      :virtualize-threshold="virtualizeThreshold"
      :row-height="30"
      :margin-y="10"
      :hot-overscan-screens="0.25"
      :reset-key="virtualListResetSeq"
      v-slot="{ dataList, renderList, isHydrated, isVirtualizing, loading, loadingMore, loadingMorePending, hasMore, loadMore }"
    >
      <template v-if="dataList.length > 0">
        <grid-layout
          :layout="canEditLayout ? (isVirtualizing ? dataList : localLayout) : dataList"
          :col-num="48"
          :row-height="30"
          :is-draggable="canEditLayout"
          :is-resizable="canEditLayout"
          :vertical-compact="canEditLayout"
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

        <div v-if="loadingMorePending || loadingMore" :class="bem('bottom-status')">
          <Loading text="加载中..." />
        </div>

        <div v-else-if="!isEditMode && hasMore" :class="bem('bottom-status')">
          <Button type="link" @click="loadMore">加载更多</Button>
        </div>

        <div v-else-if="!isEditMode && !hasMore" :class="bem('bottom-status')">
          <span :class="bem('bottom-tip')">没有更多数据了</span>
        </div>
      </template>

      <template v-else>
        <div v-if="loading" :class="bem('panel-skeleton')">
          <Skeleton :active="true" height="180px" />
        </div>

        <Empty v-else description="暂无面板">
          <Button v-if="isEditMode" type="primary" @click="handleAddPanel">添加面板</Button>
        </Empty>
      </template>
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { Alert, Button, Empty, Loading, Panel, Skeleton } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { GridLayout, GridItem } from 'vue-grid-layout-v3';
  import type { PanelLayout, Panel as PanelType, ID } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import PanelContent from '/#/components/Panel/PanelContent.vue';
  import PanelRightActions from '/#/components/Panel/PanelRightActions.vue';
  import { createNamespace, debounceCancellable } from '/#/utils';
  import VirtualList from './VirtualList.vue';

  const [_, bem] = createNamespace('grid-layout');

  const props = defineProps<{
    groupId: ID;
    panels: PanelType[];
    layout: PanelLayout[];
    /** 小组（<=阈值）直接全量渲染；大组（>阈值）启用 VirtualList 虚拟/分页规则 */
    virtualizeThreshold?: number;
  }>();

  // View 模式：page-size 作为“单次 query 的最大条数”；实际追加数量由 VirtualList（adaptivePageSize）按视口高度自适应
  const PAGE_SIZE_VIEW_MAX = 200;
  const BOTTOM_THRESHOLD_PX = 200;
  const DEFAULT_VIRTUALIZE_THRESHOLD = 10;

  const virtualizeThreshold = computed(() => Math.max(0, Math.floor(props.virtualizeThreshold ?? DEFAULT_VIRTUALIZE_THRESHOLD)));

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const canEditLayout = computed(() => isEditMode.value);

  const localLayout = ref<PanelLayout[]>([...props.layout]);

  // 监听 props.layout 变化
  watch(
    () => props.layout,
    (newLayout) => {
      // 编辑模式下：避免直接替换 array 引用导致 VirtualList 中的 dataList 引用失效
      // 使用 in-place 同步保持对象引用稳定（grid-item props 才能实时更新）
      if (isEditMode.value) {
        handleLayoutModelUpdate(newLayout);
        return;
      }
      localLayout.value = [...newLayout];
    },
    { deep: true }
  );

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

  const virtualListResetSeq = ref(0);
  watch(
    () => props.layout.length,
    () => {
      virtualListResetSeq.value++;
    }
  );
  watch(
    () => props.layout,
    () => {
      // 编辑模式下拖拽/缩放会频繁写回 store（array reference 变化），避免造成 VirtualList reset/闪动
      if (isEditMode.value) return;
      virtualListResetSeq.value++;
    },
    { deep: false }
  );

  const handleGridLayoutModelUpdate = (nextLayout: PanelLayout[]) => {
    if (!canEditLayout.value) return;
    handleLayoutModelUpdate(nextLayout);
  };

  const sortedLayout = computed<PanelLayout[]>(() => {
    const src = isEditMode.value ? localLayout.value : props.layout;
    return [...src].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return String(a.i).localeCompare(String(b.i));
    });
  });

  type VirtualListQueryArgs = { offset: number; limit: number; viewportHeight?: number };

  const queryList = async ({ offset, limit }: VirtualListQueryArgs) => {
    const all = sortedLayout.value;
    const safeOffset = Math.max(0, Math.floor(offset ?? 0));
    const maxItems = Math.max(1, Math.floor(limit ?? 1));

    const slice = all.slice(safeOffset, safeOffset + maxItems);
    return { items: slice, total: all.length };
  };

  const panelById = computed(() => {
    const map = new Map<ID, PanelType>();
    for (const p of props.panels) map.set(p.id, p);
    return map;
  });

  /**
   * 性能优化：
   * - vue-grid-layout-v3 在 dragmove/resizemove 过程中会频繁 emit layout-updated（包含全量 layout）
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
    dashboardStore.updatePanelGroupLayout(props.groupId, localLayout.value);
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

    &__bottom-status {
      display: flex;
      justify-content: center;
      padding: 10px 0;
    }

    &__bottom-tip {
      font-size: 12px;
      color: var(--gf-color-text-secondary);
    }

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
