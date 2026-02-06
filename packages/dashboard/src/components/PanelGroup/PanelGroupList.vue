<!--
  组件说明：面板组列表（PanelGroupList）

  用途：
  - 循环渲染 dashboard 的 panelGroups
  - list view 始终只展示标题（不在列表内展开渲染 panels）
  - 通过 vue-grid-layout-v3 支持拖拽排序（拖拽过程用“列表行子组件”隔离，dragend 时落盘）
  - 点击整行（header）打开聚焦层（FocusLayer），不改变底层滚动位置
  - 右侧提供：编辑面板组 / 删除面板组（创建面板组移动到全局设置）
  - 打开态的高频操作放到 FocusLayer header
-->
<template>
  <div :class="bem()">
    <grid-layout
      ref="gridLayoutRef"
      :class="bem('grid')"
      :layout="layoutModel"
      :col-num="1"
      :row-height="GROUP_ROW_HEIGHT"
      :is-draggable="canManageGroups"
      :is-resizable="false"
      :vertical-compact="true"
      :use-css-transforms="true"
      :margin="[0, 0]"
      @update:layout="handleLayoutModelUpdate"
      @layout-updated="handleLayoutUpdated"
    >
      <grid-item
        v-for="{ group, layoutItem } in renderGroups"
        :key="layoutItem.i"
        :x="layoutItem.x"
        :y="layoutItem.y"
        :w="layoutItem.w"
        :h="layoutItem.h"
        :i="layoutItem.i"
        :drag-ignore-from="dragIgnoreFrom"
        @moved="handleGroupMoved"
      >
        <PanelGroupListRow
          :ref="groupRootRef(group.id)"
          :group="group"
          :can-manage-groups="canManageGroups"
          :is-booting="isBooting"
          :is-focus-source="focusedGroupKey != null && String(group.id) === focusedGroupKey"
          :is-dragging="isDragging"
          @open="openGroup"
          @edit="handleEditGroup"
          @delete="handleDeleteGroup"
        />
      </grid-item>
    </grid-layout>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import type { ComponentPublicInstance } from 'vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';
  import { GridItem, GridLayout } from 'vue-grid-layout-v3';
  import { createNamespace } from '/#/utils';
  import { useDashboardStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import PanelGroupListRow from './PanelGroupListRow.vue';

  const [_, bem] = createNamespace('panel-group-list');

  const props = defineProps<{
    panelGroups: PanelGroup[];
    /** 当前聚焦层对应的 groupId（用于隐藏 source header，增强“标题浮起/落回”连续感） */
    focusedGroupId?: PanelGroup['id'] | null;
  }>();

  const emit = defineEmits<{
    (e: 'edit-group', group: PanelGroup): void;
    (e: 'open-group', payload: { groupId: PanelGroup['id']; headerOffsetY: number }): void;
  }>();

  const dashboardStore = useDashboardStore();
  const { isBooting, isReadOnly } = storeToRefs(dashboardStore);
  const runtime = useDashboardRuntime();
  const canManageGroups = computed(() => !isBooting.value && !isReadOnly.value);

  const panelGroups = computed(() => (Array.isArray(props.panelGroups) ? props.panelGroups : []));
  const focusedGroupKey = computed(() => (props.focusedGroupId == null ? null : String(props.focusedGroupId)));

  type GroupLayoutItem = { x: number; y: number; w: number; h: number; i: string };

  // 面板组 header（focus layer / list）保持一致：Panel size=large 的 header 高度是 44px
  // rowHeight 需要对齐实际 header 高度，否则会出现裁剪或拖拽定位偏差。
  const GROUP_ROW_HEIGHT = 44;
  const dragIgnoreFrom = '.gf-panel__title, .gf-panel__info, button, a, input, textarea';

  const layoutModel = ref<GroupLayoutItem[]>([]);
  let pendingLayoutModel: GroupLayoutItem[] | null = null;
  let layoutUpdateRafId: number | null = null;
  const layoutKey = computed(() => panelGroups.value.map((g) => String(g.id)).join('|'));

  const groupById = computed(() => {
    const map = new Map<string, PanelGroup>();
    for (const g of panelGroups.value) map.set(String(g.id), g);
    return map;
  });

  const renderGroups = computed(() => {
    return layoutModel.value
      .map((layoutItem) => ({ layoutItem, group: groupById.value.get(layoutItem.i) }))
      .filter((it): it is { layoutItem: GroupLayoutItem; group: PanelGroup } => Boolean(it.group));
  });

  const syncLayoutFromGroups = () => {
    layoutModel.value = panelGroups.value.map((g, idx) => ({ x: 0, y: idx, w: 1, h: 1, i: String(g.id) }));
  };

  watch(layoutKey, syncLayoutFromGroups, { immediate: true });

  // ---------------------------
  // DOM refs (for FocusLayer startOffsetY)
  // ---------------------------
  const groupRootElById = new Map<string, HTMLElement>();

  type GroupRootRefFn = (el: Element | ComponentPublicInstance | null) => void;
  const groupRootRefFnById = new Map<string, GroupRootRefFn>();
  const groupRootRef = (groupId: PanelGroup['id']): GroupRootRefFn => {
    const key = String(groupId);
    const existing = groupRootRefFnById.get(key);
    if (existing) return existing;

    const fn: GroupRootRefFn = (el) => {
      const maybeEl = (el as any)?.$el instanceof HTMLElement ? (el as any).$el : el;
      const node = maybeEl instanceof HTMLElement ? maybeEl : null;
      if (!node) {
        groupRootElById.delete(key);
        return;
      }
      groupRootElById.set(key, node);
    };
    groupRootRefFnById.set(key, fn);
    return fn;
  };

  const getHeaderOffsetY = (groupId: PanelGroup['id']): number => {
    const root = runtime.rootEl?.value;
    const wrapper = groupRootElById.get(String(groupId));
    const header = wrapper?.querySelector('.gf-panel__header') as HTMLElement | null;
    if (!root || !header) return 0;
    const headerRect = header.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const raw = headerRect.top - rootRect.top;
    const max = Math.max(0, Math.floor(root.clientHeight));
    return Math.max(0, Math.min(max, Math.floor(raw)));
  };

  // ---------------------------
  // Layout model updates (drag performance)
  // ---------------------------
  const applyLayoutModelUpdate = (nextLayout: GroupLayoutItem[]) => {
    const currentById = new Map<string, GroupLayoutItem>();
    layoutModel.value.forEach((it) => currentById.set(String(it.i), it));

    const nextRefs: GroupLayoutItem[] = [];
    for (const next of nextLayout) {
      const id = String(next.i);
      const existing = currentById.get(id);
      if (existing) {
        Object.assign(existing, next);
        nextRefs.push(existing);
      } else {
        nextRefs.push({ ...next });
      }
    }
    layoutModel.value = nextRefs;
  };

  const flushPendingLayoutUpdate = () => {
    if (layoutUpdateRafId != null) {
      window.cancelAnimationFrame(layoutUpdateRafId);
      layoutUpdateRafId = null;
    }
    if (!pendingLayoutModel) return;
    const layout = pendingLayoutModel;
    pendingLayoutModel = null;
    applyLayoutModelUpdate(layout);
  };

  const scheduleLayoutModelUpdate = (nextLayout: GroupLayoutItem[]) => {
    pendingLayoutModel = nextLayout;
    if (layoutUpdateRafId != null) return;
    layoutUpdateRafId = window.requestAnimationFrame(() => {
      layoutUpdateRafId = null;
      if (!pendingLayoutModel) return;
      const layout = pendingLayoutModel;
      pendingLayoutModel = null;
      applyLayoutModelUpdate(layout);
    });
  };

  const handleLayoutModelUpdate = (nextLayout: GroupLayoutItem[]) => {
    // vue-grid-layout-v3 在拖拽过程中会高频 emit(update:layout)（每次都会 clone layout）
    // 直接 v-model 赋值会导致大量新对象/数组分配 & 触发列表高频 patch（拖动卡顿明显）。
    // 这里改为：按 rAF 合并更新 + in-place 同步（复用 layout item 引用），降低主线程压力。
    scheduleLayoutModelUpdate(nextLayout);
  };

  // ---------------------------
  // Drag & drop
  // ---------------------------
  const lastDragEndAt = ref(0);
  const DRAG_CLICK_SUPPRESS_MS = 100;

  const isDragging = ref(false);
  const gridLayoutRef = ref<any>(null);

  const handleGridDragEvent = (payload: unknown) => {
    if (!canManageGroups.value) return;
    if (!Array.isArray(payload) || payload.length === 0) return;
    const eventName = String(payload[0]);
    if (eventName === 'dragstart') {
      isDragging.value = true;
      return;
    }
    if (eventName === 'dragend') {
      lastDragEndAt.value = Date.now();
      isDragging.value = false;
    }
  };

  const openGroup = (groupId: PanelGroup['id']) => {
    if (isBooting.value) return;
    // 拖拽排序结束后会产生 click：短时间内忽略“打开组”，避免误触
    if (Date.now() - lastDragEndAt.value < DRAG_CLICK_SUPPRESS_MS) return;
    emit('open-group', { groupId, headerOffsetY: getHeaderOffsetY(groupId) });
  };

  const handleEditGroup = (group: PanelGroup) => {
    if (!canManageGroups.value) return;
    emit('edit-group', group);
  };

  const handleDeleteGroup = (groupId: PanelGroup['id']) => {
    if (!canManageGroups.value) return;
    dashboardStore.deletePanelGroup(groupId);
  };

  const handleLayoutUpdated = () => {
    // 由 dragend 做最终落盘；这里保留空实现用于未来扩展（例如 debug）
  };

  const handleGroupMoved = () => {
    if (!canManageGroups.value) return;
    flushPendingLayoutUpdate();
    // drag end: commit order to store
    lastDragEndAt.value = Date.now();
    isDragging.value = false;
    const currentOrder = panelGroups.value.map((g) => String(g.id));
    const nextOrder = [...layoutModel.value]
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((it) => it.i);
    if (nextOrder.join('|') === currentOrder.join('|')) return;
    dashboardStore.reorderPanelGroups(nextOrder);
  };

  onMounted(() => {
    const emitter = gridLayoutRef.value?.emitter;
    if (!emitter?.on) return;
    emitter.on('dragEvent', handleGridDragEvent);
  });

  onBeforeUnmount(() => {
    const emitter = gridLayoutRef.value?.emitter;
    if (emitter?.off) emitter.off('dragEvent', handleGridDragEvent);
    isDragging.value = false;
    flushPendingLayoutUpdate();
  });
</script>

<style scoped lang="less">
  .dp-panel-group-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 8px 0;

    // Grid item styling - 拖拽优化
    :deep(.vue-grid-item) {
      // 关键：拖拽时禁用所有 transition 避免卡顿
      transition: none;
      position: relative;

      // 列表态视觉分割线（不参与布局尺寸计算，避免影响拖拽定位）
      &::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 1px;
        background: var(--gf-color-border-muted);
        pointer-events: none;
      }

      &:hover {
        z-index: 10;
      }

      // 拖拽中：仅使用简单的 outline 而非昂贵的 box-shadow
      &.vue-draggable-dragging {
        z-index: 100;
        outline: 2px solid var(--gf-color-primary);
        outline-offset: -1px;
        border-radius: 0;
        opacity: 0.95;
        // 禁用任何 transition
        transition: none !important;

        &::after {
          opacity: 0;
        }

        * {
          transition: none !important;
        }
      }
    }
  }
</style>
