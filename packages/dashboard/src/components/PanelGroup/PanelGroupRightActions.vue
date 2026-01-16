<!--
  组件说明：面板组右侧操作区（PanelGroupRightActions）

  用途：
  - 添加面板、编辑面板组、上移/下移排序、删除面板组
  - 主要在编辑模式下出现（由上层控制渲染条件）
-->
<template>
  <div :class="bem()">
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
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { Button, Popconfirm, Tooltip } from '@grafana-fast/component';
  import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-group-right-actions');

  const props = defineProps<{
    group: PanelGroup;
    index: number;
    isLast?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'edit', group: PanelGroup): void;
  }>();

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();

  const handleAddPanel = () => {
    editorStore.openCreateEditor(props.group.id);
  };

  const handleEdit = () => {
    emit('edit', props.group);
  };

  const handleMoveUp = () => {
    if (props.index > 0) dashboardStore.movePanelGroup(props.index, props.index - 1);
  };

  const handleMoveDown = () => {
    dashboardStore.movePanelGroup(props.index, props.index + 1);
  };

  const handleDelete = () => {
    dashboardStore.deletePanelGroup(props.group.id);
  };
</script>

<style scoped lang="less">
  .dp-panel-group-right-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-left: auto;

    :deep(.gf-button) {
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border-radius: var(--gf-radius-sm);

      &:hover {
        background-color: var(--gf-color-fill);
      }
    }
  }
</style>
