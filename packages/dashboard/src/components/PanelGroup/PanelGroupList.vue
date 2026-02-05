<!--
  组件说明：面板组列表（PanelGroupList）

  用途：
  - 循环渲染 dashboard 的 panelGroups
  - list view 始终只展示标题（不在列表内展开渲染 panels）
  - 通过 vue-grid-layout-v3 支持“随时拖拽排序”（不依赖全局编辑模式）
  - 点击整行（header）打开聚焦层（FocusLayer），不改变底层滚动位置
  - 右侧提供：编辑面板组 / 删除面板组（创建面板组移动到全局设置）
  - 打开态的高频操作放到 FocusLayer header
-->
<template>
  <div :class="[bem(), { 'is-dragging': isDragging }]">
    <grid-layout
      v-model:layout="layoutModel"
      :col-num="1"
      :row-height="GROUP_ROW_HEIGHT"
      :is-draggable="canManageGroups"
      :is-resizable="false"
      :vertical-compact="true"
      :use-css-transforms="true"
      :margin="[0, 0]"
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
        @move="handleGroupMove"
        @moved="handleGroupMoved"
      >
        <div
          :ref="groupRootRef(group.id)"
          :class="[bem('group'), { 'is-focus-source': focusedGroupKey != null && String(group.id) === focusedGroupKey }]"
        >
          <Panel
            :title="group.title || '未命名面板组'"
            :description="group.description"
            size="large"
            header-variant="list-row"
            :collapsible="!isBooting"
            :collapsed="true"
            :bordered="false"
            :ghost="true"
            :hoverable="false"
            :body-padding="false"
            @update:collapsed="(collapsed: boolean) => handleCollapsedChange(group.id, collapsed)"
            @title-click="() => handleTitleClick(group.id)"
          >
            <template v-if="canManageGroups" #right>
              <div :class="bem('actions')">
                <Tooltip title="编辑面板组">
                  <Button icon-only type="text" size="middle" :icon="h(EditOutlined)" @click="() => handleEditGroup(group)" />
                </Tooltip>
                <Popconfirm title="确定要删除这个面板组吗？" ok-text="确定" cancel-text="取消" @confirm="() => handleDeleteGroup(group.id)">
                  <Tooltip title="删除面板组">
                    <Button icon-only type="text" size="middle" :icon="h(DeleteOutlined)" :class="bem('delete-btn')" />
                  </Tooltip>
                </Popconfirm>
              </div>
            </template>
          </Panel>
        </div>
      </grid-item>
    </grid-layout>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref, watch } from 'vue';
  import type { ComponentPublicInstance } from 'vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, Panel, Popconfirm, Tooltip } from '@grafana-fast/component';
  import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
  import { GridLayout, GridItem } from 'vue-grid-layout-v3';
  import { createNamespace } from '/#/utils';
  import { useDashboardStore } from '/#/stores';
  import { useDashboardRuntime } from '/#/runtime/useInjected';

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

  const groupRootElById = new Map<string, HTMLElement>();
  const focusedGroupKey = computed(() => (props.focusedGroupId == null ? null : String(props.focusedGroupId)));

  type GroupLayoutItem = { x: number; y: number; w: number; h: number; i: string };

  const GROUP_ROW_HEIGHT = 44;
  const dragIgnoreFrom = '.gf-panel__title, .gf-panel__info, button, a, input, textarea';

  const layoutModel = ref<GroupLayoutItem[]>([]);
  const layoutKey = computed(() => (props.panelGroups ?? []).map((g) => String(g.id)).join('|'));

  const groupById = computed(() => {
    const map = new Map<string, PanelGroup>();
    for (const g of props.panelGroups ?? []) map.set(String(g.id), g);
    return map;
  });

  const renderGroups = computed(() => {
    return layoutModel.value
      .map((layoutItem) => ({ layoutItem, group: groupById.value.get(layoutItem.i) }))
      .filter((it): it is { layoutItem: GroupLayoutItem; group: PanelGroup } => Boolean(it.group));
  });

  const syncLayoutFromGroups = () => {
    const groups = Array.isArray(props.panelGroups) ? props.panelGroups : [];
    layoutModel.value = groups.map((g, idx) => ({ x: 0, y: idx, w: 1, h: 1, i: String(g.id) }));
  };

  watch(layoutKey, syncLayoutFromGroups, { immediate: true });

  const groupRootRef = (groupId: PanelGroup['id']) => (el: Element | ComponentPublicInstance | null) => {
    const key = String(groupId);
    const maybeEl = (el as any)?.$el instanceof HTMLElement ? (el as any).$el : el;
    const node = maybeEl instanceof HTMLElement ? maybeEl : null;
    if (!node) {
      groupRootElById.delete(key);
      return;
    }
    groupRootElById.set(key, node);
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

  const lastDragEndAt = ref(0);
  const DRAG_CLICK_SUPPRESS_MS = 180;

  const isDragging = ref(false);

  const openGroup = (groupId: PanelGroup['id']) => {
    if (isBooting.value) return;
    // 拖拽排序结束后会产生 click：短时间内忽略“打开组”，避免误触
    if (Date.now() - lastDragEndAt.value < DRAG_CLICK_SUPPRESS_MS) return;
    emit('open-group', { groupId, headerOffsetY: getHeaderOffsetY(groupId) });
  };

  const handleTitleClick = (groupId: PanelGroup['id']) => {
    openGroup(groupId);
  };

  const handleEditGroup = (group: PanelGroup) => {
    if (!canManageGroups.value) return;
    emit('edit-group', group);
  };

  const handleCollapsedChange = (groupId: PanelGroup['id'], collapsed: boolean) => {
    if (isBooting.value) return;
    // list view 中始终折叠：点击 header 触发 “展开请求” 时打开 focus layer
    if (collapsed) return;
    openGroup(groupId);
  };

  const handleDeleteGroup = (groupId: PanelGroup['id']) => {
    if (!canManageGroups.value) return;
    dashboardStore.deletePanelGroup(groupId);
  };

  const handleLayoutUpdated = () => {
    // 由 moved 事件做最终落盘，这里保留空实现用于未来扩展（例如 debug）
  };

  const handleGroupMove = () => {
    if (!canManageGroups.value) return;
    if (!isDragging.value) isDragging.value = true;
  };

  const handleGroupMoved = () => {
    if (!canManageGroups.value) return;
    // drag end: commit order to store
    lastDragEndAt.value = Date.now();
    isDragging.value = false;
    const nextOrder = [...layoutModel.value]
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((it) => it.i);
    dashboardStore.reorderPanelGroups(nextOrder);
  };
</script>

<style scoped lang="less">
  .dp-panel-group-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 8px 0;

    &.is-dragging {
      // 拖拽时禁用 hover 视觉反馈（box-shadow/gradient）与操作按钮渐变，减少 repaint
      :deep(.gf-panel--header-variant-list-row .gf-panel__header) {
        transition: none !important;
      }

      :deep(.gf-panel--header-variant-list-row .gf-panel__header:hover) {
        border-color: var(--gf-color-border) !important;
        box-shadow: var(--gf-shadow-1) !important;
        background: linear-gradient(135deg, var(--gf-color-surface) 0%, var(--gf-color-surface-raised) 100%) !important;
      }

      :deep(.gf-panel:hover) .dp-panel-group-list__actions {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }

    &__group {
      border-radius: var(--gf-radius-lg);
      // 拖拽时禁用 transition，避免卡顿
      transition: none;
      animation: gf-fade-slide-in 0.35s var(--gf-easing) backwards;
      // 使用 CSS 变量实现 stagger 动画
      animation-delay: calc(var(--gf-stagger-index, 0) * 30ms);
    }

    // 手动设置前 15 个的 stagger index
    &__group:nth-child(1) {
      --gf-stagger-index: 0;
    }
    &__group:nth-child(2) {
      --gf-stagger-index: 1;
    }
    &__group:nth-child(3) {
      --gf-stagger-index: 2;
    }
    &__group:nth-child(4) {
      --gf-stagger-index: 3;
    }
    &__group:nth-child(5) {
      --gf-stagger-index: 4;
    }
    &__group:nth-child(6) {
      --gf-stagger-index: 5;
    }
    &__group:nth-child(7) {
      --gf-stagger-index: 6;
    }
    &__group:nth-child(8) {
      --gf-stagger-index: 7;
    }
    &__group:nth-child(9) {
      --gf-stagger-index: 8;
    }
    &__group:nth-child(10) {
      --gf-stagger-index: 9;
    }
    &__group:nth-child(11) {
      --gf-stagger-index: 10;
    }
    &__group:nth-child(12) {
      --gf-stagger-index: 11;
    }
    &__group:nth-child(13) {
      --gf-stagger-index: 12;
    }
    &__group:nth-child(14) {
      --gf-stagger-index: 13;
    }
    &__group:nth-child(15) {
      --gf-stagger-index: 14;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);
    }

    // Show actions on hover
    :deep(.gf-panel:hover) .dp-panel-group-list__actions {
      opacity: 1;
      pointer-events: auto;
    }

    &__group.is-focus-source {
      :deep(.gf-panel__header) {
        opacity: 0;
      }
    }

    &__delete-btn {
      --gf-btn-color: var(--gf-color-danger);
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: color-mix(in srgb, var(--gf-color-danger), transparent 90%);
      --gf-btn-bg-active: color-mix(in srgb, var(--gf-color-danger), transparent 85%);
      --gf-btn-shadow-hover: none;

      &:hover {
        --gf-btn-color: var(--gf-color-danger-hover);
      }
    }

    // Grid item styling - 拖拽优化
    :deep(.vue-grid-item) {
      // 关键：拖拽时禁用所有 transition 避免卡顿
      transition: none;

      &:hover {
        z-index: 10;
      }

      // 拖拽中：仅使用简单的 outline 而非昂贵的 box-shadow
      &.vue-draggable-dragging {
        z-index: 100;
        outline: 2px solid var(--gf-color-primary);
        outline-offset: -1px;
        border-radius: var(--gf-radius-lg);
        opacity: 0.95;
        // 禁用任何 transition
        transition: none !important;

        * {
          transition: none !important;
        }
      }
    }

    // Panel header styling in list view - 优化视觉效果
    :deep(.gf-panel--header-variant-list-row) {
      .gf-panel__header {
        padding: 0 20px;
        height: 52px;
        border-radius: var(--gf-radius-lg);
        background: linear-gradient(135deg, var(--gf-color-surface) 0%, var(--gf-color-surface-raised) 100%);
        border: 1px solid var(--gf-color-border);
        box-shadow: var(--gf-shadow-1);
        transition:
          border-color var(--gf-motion-fast) var(--gf-easing),
          box-shadow var(--gf-motion-fast) var(--gf-easing),
          background var(--gf-motion-fast) var(--gf-easing);

        &:hover {
          border-color: var(--gf-color-primary-border);
          box-shadow: var(--gf-shadow-2);
          background: linear-gradient(135deg, var(--gf-color-surface-raised) 0%, var(--gf-color-bg-elevated) 100%);
        }
      }

      .gf-panel__title {
        font-size: 15px;
        font-weight: 600;
        color: var(--gf-color-text-heading);
        letter-spacing: 0.01em;
      }

      .gf-panel__collapse-icon {
        color: var(--gf-color-primary);
        transition: transform var(--gf-motion-normal) var(--gf-easing);
      }
    }
  }

  // 入场动画
  @keyframes gf-fade-slide-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
