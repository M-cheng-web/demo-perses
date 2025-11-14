<template>
  <div class="panel-group-header" @click="handleHeaderClick">
    <div class="header-content">
      <a-button
        type="text"
        :icon="h(group.isCollapsed ? RightOutlined : DownOutlined)"
        size="small"
        class="collapse-btn"
        @click.stop="handleToggleCollapse"
      />
      <h3 class="group-title">{{ group.title || '未命名面板组' }}</h3>
      <a-tooltip v-if="group.description" :title="group.description">
        <InfoCircleOutlined class="info-icon" />
      </a-tooltip>
    </div>

    <div v-if="isEditMode" class="header-actions" @click.stop>
      <a-tooltip title="添加面板">
        <a-button type="text" size="small" :icon="h(PlusOutlined)" @click="handleAddPanel" />
      </a-tooltip>
      <a-tooltip title="编辑面板组">
        <a-button type="text" size="small" :icon="h(EditOutlined)" @click="handleEdit" />
      </a-tooltip>
      <a-tooltip title="上移">
        <a-button type="text" size="small" :icon="h(ArrowUpOutlined)" :disabled="index === 0" @click="handleMoveUp" />
      </a-tooltip>
      <a-tooltip title="下移">
        <a-button type="text" size="small" :icon="h(ArrowDownOutlined)" :disabled="isLast" @click="handleMoveDown" />
      </a-tooltip>
      <a-popconfirm title="确定要删除这个面板组吗？" ok-text="确定" cancel-text="取消" @confirm="handleDelete">
        <a-tooltip title="删除面板组">
          <a-button type="text" size="small" danger :icon="h(DeleteOutlined)" />
        </a-tooltip>
      </a-popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { storeToRefs } from 'pinia';
  import {
    RightOutlined,
    DownOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    InfoCircleOutlined,
  } from '@ant-design/icons-vue';
  import type { PanelGroup } from '@/types';
  import { useDashboardStore, useEditorStore } from '@/stores';

  const props = defineProps<{
    group: PanelGroup;
    index: number;
    isLast?: boolean;
  }>();

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const handleHeaderClick = () => {
    // 点击整个头部区域也可以折叠/展开
    handleToggleCollapse();
  };

  const handleToggleCollapse = () => {
    dashboardStore.updatePanelGroup(props.group.id, {
      isCollapsed: !props.group.isCollapsed,
    });
  };

  const handleAddPanel = () => {
    editorStore.openCreateEditor(props.group.id);
  };

  const emit = defineEmits<{
    (e: 'edit', group: PanelGroup): void;
  }>();

  const handleEdit = () => {
    emit('edit', props.group);
  };

  const handleMoveUp = () => {
    if (props.index > 0) {
      dashboardStore.movePanelGroup(props.index, props.index - 1);
    }
  };

  const handleMoveDown = () => {
    dashboardStore.movePanelGroup(props.index, props.index + 1);
  };

  const handleDelete = () => {
    dashboardStore.deletePanelGroup(props.group.id);
  };
</script>

<style scoped lang="less">
  .panel-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background-color: @background-base;
    border-bottom: 1px solid @border-color;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: @background-light;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;

      .collapse-btn {
        flex-shrink: 0;
        padding: 0;
        width: 24px;
        height: 24px;
      }

      .group-title {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: @text-color;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .info-icon {
        color: @text-color-secondary;
        font-size: 14px;
        cursor: help;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      cursor: default;

      :deep(.ant-btn) {
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
</style>
