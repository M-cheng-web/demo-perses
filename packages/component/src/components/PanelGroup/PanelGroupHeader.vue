<template>
  <div :class="bem()" @click="handleHeaderClick">
    <div :class="bem('content')">
      <Button
        type="text"
        :icon="h(group.isCollapsed ? RightOutlined : DownOutlined)"
        size="small"
        :class="bem('collapse-btn')"
        @click.stop="handleToggleCollapse"
      />
      <h3 :class="bem('title')">{{ group.title || '未命名面板组' }}</h3>
      <Tooltip v-if="group.description" :title="group.description">
        <InfoCircleOutlined :class="bem('info-icon')" />
      </Tooltip>
    </div>

    <div v-if="isEditMode" :class="bem('actions')" @click.stop>
      <Tooltip title="添加面板">
        <Button type="text" size="small" :icon="h(PlusOutlined)" @click="handleAddPanel" />
      </Tooltip>
      <Tooltip title="编辑面板组">
        <Button type="text" size="small" :icon="h(EditOutlined)" @click="handleEdit" />
      </Tooltip>
      <Tooltip title="上移">
        <Button type="text" size="small" :icon="h(ArrowUpOutlined)" :disabled="index === 0" @click="handleMoveUp" />
      </Tooltip>
      <Tooltip title="下移">
        <Button type="text" size="small" :icon="h(ArrowDownOutlined)" :disabled="isLast" @click="handleMoveDown" />
      </Tooltip>
      <Popconfirm title="确定要删除这个面板组吗？" ok-text="确定" cancel-text="取消" @confirm="handleDelete">
        <Tooltip title="删除面板组">
          <Button type="text" size="small" danger :icon="h(DeleteOutlined)" />
        </Tooltip>
      </Popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { storeToRefs } from 'pinia';
  import { Button, Tooltip, Popconfirm } from 'ant-design-vue';
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
  import type { PanelGroup } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-group-header');

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
  .dp-panel-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 8px 16px;
    background-color: @background-base;
    border-bottom: 1px solid @border-color;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: @background-light;
    }

    &__content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    &__collapse-btn {
      flex-shrink: 0;
      padding: 0;
      width: 24px;
      height: 24px;
    }

    &__title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: @text-color;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__info-icon {
      color: @text-color-secondary;
      font-size: 14px;
      cursor: help;
    }

    &__actions {
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
