<!--
  组件说明：面板右侧操作区（PanelRightActions）

  用途：
  - 提供“编辑 / 复制 / 全屏 / 删除”等高频动作
  - 默认仅在 hover 或编辑模式下显示（减少界面干扰）
-->
<template>
  <div :class="[bem(), { 'is-visible': isVisible }]">
    <template v-if="!isEditing">
      <Tooltip title="全屏查看">
        <Button icon-only type="text" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
      </Tooltip>
    </template>

    <template v-else>
      <Tooltip title="编辑">
        <Button icon-only type="text" :icon="h(EditOutlined)" @click="handleEdit" />
      </Tooltip>
      <Tooltip title="复制">
        <Button icon-only type="text" :icon="h(CopyOutlined)" @click="handleDuplicate" />
      </Tooltip>
      <Tooltip title="全屏查看">
        <Button icon-only type="text" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
      </Tooltip>
      <Popconfirm title="确定要删除这个面板吗？" ok-text="确定" cancel-text="取消" @confirm="handleDelete">
        <Tooltip title="删除">
          <Button icon-only type="text" :class="bem('delete-btn')" :icon="h(DeleteOutlined)" />
        </Tooltip>
      </Popconfirm>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, h } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, Popconfirm, Tooltip, message } from '@grafana-fast/component';
  import { CopyOutlined, DeleteOutlined, EditOutlined, FullscreenOutlined } from '@ant-design/icons-vue';
  import type { ID, Panel } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-right-actions');

  const props = defineProps<{
    groupId: ID;
    panel: Panel;
    /** hover 状态（由 @grafana-fast/component 的 Panel slot props 注入） */
    hovered: boolean;
  }>();

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { editingGroupId, viewMode, isBooting, isReadOnly } = storeToRefs(dashboardStore);

  const isEditing = computed(() => {
    if (isBooting.value) return false;
    if (isReadOnly.value) return false;
    if (viewMode.value === 'allPanels') return false;
    if (editingGroupId.value == null) return false;
    return String(editingGroupId.value) === String(props.groupId);
  });

  const isVisible = computed(() => isEditing.value || props.hovered);

  const handleEdit = () => {
    if (isReadOnly.value) return;
    editorStore.openEditEditor(props.groupId, props.panel);
  };

  const handleDuplicate = () => {
    if (isReadOnly.value) return;
    dashboardStore.duplicatePanel(props.groupId, props.panel.id);
    message.success('面板已复制');
  };

  const handleFullscreen = () => {
    dashboardStore.togglePanelView(props.groupId, props.panel.id);
  };

  const handleDelete = () => {
    if (isReadOnly.value) return;
    dashboardStore.deletePanel(props.groupId, props.panel.id);
    message.success('面板已删除');
  };
</script>

<style scoped lang="less">
  .dp-panel-right-actions {
    display: none;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
    opacity: 0;
    transition: opacity var(--gf-motion-fast) var(--gf-easing);

    &.is-visible {
      display: flex;
      opacity: 1;
    }

    :deep(.gf-button--icon-only) {
      --gf-btn-icon-only-size: 28px;
    }

    &__delete-btn {
      --gf-btn-color: var(--gf-color-danger);
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: color-mix(in srgb, var(--gf-color-danger), transparent 90%);
      --gf-btn-bg-active: color-mix(in srgb, var(--gf-color-danger), transparent 85%);
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-shadow-hover: none;

      &:hover {
        --gf-btn-color: var(--gf-color-danger-hover);
      }
    }
  }
</style>
