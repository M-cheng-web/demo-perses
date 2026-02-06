<!--
  组件说明：面板组列表行（PanelGroupListRow）

  目的：
  - 作为 vue-grid-layout-v3 的 slot 内容：在拖拽过程中避免被父组件的 layout 高频更新影响而反复 patch
  - 只负责渲染一行 Panel header + actions，并把事件上抛给 PanelGroupList
-->
<template>
  <div
    :class="[
      bem('group'),
      {
        'is-draggable': canManageGroups,
        'is-focus-source': isFocusSource,
        'is-dragging': isDragging,
      },
    ]"
  >
    <Panel
      :title="title"
      :description="description"
      size="large"
      header-variant="list-row"
      :collapsible="!isBooting"
      :collapsed="true"
      :bordered="false"
      :ghost="false"
      :hoverable="false"
      :body-padding="false"
      @update:collapsed="handleCollapsedChange"
      @title-click="handleTitleClick"
    >
      <template v-if="canManageGroups" #right>
        <div :class="bem('actions')">
          <Tooltip title="编辑面板组">
            <Button icon-only type="text" size="middle" :icon="h(EditOutlined)" @click="handleEditGroup" />
          </Tooltip>
          <Popconfirm title="确定要删除这个面板组吗？" ok-text="确定" cancel-text="取消" @confirm="handleDeleteGroup">
            <Tooltip title="删除面板组">
              <Button icon-only type="text" size="middle" :icon="h(DeleteOutlined)" :class="bem('delete-btn')" />
            </Tooltip>
          </Popconfirm>
        </div>
      </template>
    </Panel>
  </div>
</template>

<script setup lang="ts">
  import { computed, h } from 'vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import { Button, Panel, Popconfirm, Tooltip } from '@grafana-fast/component';
  import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-group-list');

  const props = defineProps<{
    group: PanelGroup;
    canManageGroups: boolean;
    isBooting: boolean;
    isFocusSource: boolean;
    /** 拖拽进行中（用于禁用 hover 动画与隐藏 actions，避免 repaint） */
    isDragging: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'open', groupId: PanelGroup['id']): void;
    (e: 'edit', group: PanelGroup): void;
    (e: 'delete', groupId: PanelGroup['id']): void;
  }>();

  const title = computed(() => props.group.title || '未命名面板组');
  const description = computed(() => props.group.description || '');

  const requestOpen = () => {
    emit('open', props.group.id);
  };

  const handleTitleClick = () => {
    requestOpen();
  };

  const handleCollapsedChange = (collapsed: boolean) => {
    // list view 中始终折叠：点击 header 触发 “展开请求” 时打开 focus layer
    if (collapsed) return;
    requestOpen();
  };

  const handleEditGroup = () => {
    if (!props.canManageGroups) return;
    emit('edit', props.group);
  };

  const handleDeleteGroup = () => {
    if (!props.canManageGroups) return;
    emit('delete', props.group.id);
  };
</script>

<style scoped lang="less">
  .dp-panel-group-list__group {
    border-radius: 0;
    // 拖拽时禁用 transition，避免卡顿
    transition: none;
    animation: gf-fade-slide-in 0.35s var(--gf-easing) backwards;
    user-select: none;
    position: relative;

    &.is-draggable {
      cursor: grab;
    }

    :deep(.gf-panel) {
      border-radius: 0;
    }

    // 面板组列表的“横线分割”：由 header 的 border-bottom 负责（始终显示，不依赖 hover）
    :deep(.gf-panel__header) {
      border-radius: 0;
      border-bottom-color: var(--gf-color-border);
    }

    &.is-dragging {
      // 拖拽时隐藏 actions，避免 hover 渐变触发 repaint
      .dp-panel-group-list__actions {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }

    &.is-focus-source {
      :deep(.gf-panel__header) {
        opacity: 0;
      }
    }
  }

  .dp-panel-group-list__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--gf-motion-fast) var(--gf-easing);
  }

  // Show actions on hover
  .dp-panel-group-list__group:hover .dp-panel-group-list__actions {
    opacity: 1;
    pointer-events: auto;
  }

  .dp-panel-group-list__delete-btn {
    --gf-btn-color: var(--gf-color-danger);
    --gf-btn-bg: transparent;
    --gf-btn-bg-hover: color-mix(in srgb, var(--gf-color-danger), transparent 90%);
    --gf-btn-bg-active: color-mix(in srgb, var(--gf-color-danger), transparent 85%);
    --gf-btn-shadow-hover: none;

    &:hover {
      --gf-btn-color: var(--gf-color-danger-hover);
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
