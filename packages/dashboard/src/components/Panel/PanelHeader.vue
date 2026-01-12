<template>
  <div :class="bem()">
    <div :class="bem('content')">
      <h4 :class="bem('title')">{{ panel.name }}</h4>
      <Tooltip v-if="panel.description" :title="panel.description">
        <InfoCircleOutlined :class="bem('info-icon')" />
      </Tooltip>
    </div>

    <div :class="bem('actions')">
      <!-- 非编辑模式：只在 hover 时显示放大按钮 -->
      <template v-if="!isEditMode">
        <Tooltip title="全屏查看">
          <Button type="text" size="small" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
        </Tooltip>
      </template>
    </div>

    <div :class="bem('actions-edit')" v-if="isEditMode">
      <Tooltip title="编辑">
        <Button type="text" size="small" :icon="h(EditOutlined)" @click="handleEdit" />
      </Tooltip>
      <Tooltip title="复制">
        <Button type="text" size="small" :icon="h(CopyOutlined)" @click="handleDuplicate" />
      </Tooltip>
      <Tooltip title="全屏查看">
        <Button type="text" size="small" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
      </Tooltip>
      <Popconfirm title="确定要删除这个面板吗？" ok-text="确定" cancel-text="取消" @confirm="handleDelete">
        <Tooltip title="删除">
          <Button type="text" size="small" danger :icon="h(DeleteOutlined)" />
        </Tooltip>
      </Popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Button, Tooltip, Popconfirm, message } from '@grafana-fast/component';
  import { EditOutlined, CopyOutlined, DeleteOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';
  import type { Panel, ID } from '@grafana-fast/types';
  import { useDashboardStore, useEditorStore } from '/#/stores';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-header');

  const props = defineProps<{
    groupId: ID;
    panel: Panel;
  }>();

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const { isEditMode } = storeToRefs(dashboardStore);

  const handleEdit = () => {
    editorStore.openEditEditor(props.groupId, props.panel);
  };

  const handleDuplicate = () => {
    dashboardStore.duplicatePanel(props.groupId, props.panel.id);
    message.success('面板已复制');
  };

  const handleFullscreen = () => {
    dashboardStore.togglePanelView(props.groupId, props.panel.id);
  };

  const handleDelete = () => {
    dashboardStore.deletePanel(props.groupId, props.panel.id);
    message.success('面板已删除');
  };
</script>

<style scoped lang="less">
  .dp-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px 2px 8px;
    min-height: 30px;
    border-bottom: 1px solid @border-color;
    background-color: @background-base;
    flex-shrink: 0;

    &__content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    &__title {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      line-height: 24px;
      min-height: 26px;
      color: @text-color;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__info-icon {
      color: @text-color-secondary;
      font-size: 12px;
      flex-shrink: 0;
      cursor: help;
    }

    &__actions-edit {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      margin-left: auto;
    }

    &__actions {
      display: var(--panel-hover, none);
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      margin-left: auto;

      :deep(.gf-button) {
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;

        &:hover {
          background-color: @background-light;
        }
      }
    }
  }
</style>
