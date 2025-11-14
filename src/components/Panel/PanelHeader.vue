<template>
  <div class="panel-header">
    <div class="header-content">
      <h4 class="panel-title">{{ panel.name }}</h4>
      <a-tooltip v-if="panel.description" :title="panel.description">
        <InfoCircleOutlined class="info-icon" />
      </a-tooltip>
    </div>

    <div class="header-actions">
      <!-- 非编辑模式：只在 hover 时显示放大按钮 -->
      <template v-if="!isEditMode">
        <a-tooltip title="全屏查看">
          <a-button type="text" size="small" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
        </a-tooltip>
      </template>
      <!-- 编辑模式：显示所有操作按钮 -->
      <template v-else>
        <a-tooltip title="编辑">
          <a-button type="text" size="small" :icon="h(EditOutlined)" @click="handleEdit" />
        </a-tooltip>
        <a-tooltip title="复制">
          <a-button type="text" size="small" :icon="h(CopyOutlined)" @click="handleDuplicate" />
        </a-tooltip>
        <a-tooltip title="全屏查看">
          <a-button type="text" size="small" :icon="h(FullscreenOutlined)" @click="handleFullscreen" />
        </a-tooltip>
        <a-popconfirm title="确定要删除这个面板吗？" ok-text="确定" cancel-text="取消" @confirm="handleDelete">
          <a-tooltip title="删除">
            <a-button type="text" size="small" danger :icon="h(DeleteOutlined)" />
          </a-tooltip>
        </a-popconfirm>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue';
  import { storeToRefs } from 'pinia';
  import { EditOutlined, CopyOutlined, DeleteOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';
  import type { Panel, ID } from '@/types';
  import { useDashboardStore, useEditorStore } from '@/stores';
  import { message } from 'ant-design-vue';

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
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px 2px 8px;
    min-height: 30px;
    border-bottom: 1px solid @border-color;
    background-color: @background-base;
    flex-shrink: 0;

    .header-content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      overflow: hidden;

      .panel-title {
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

      .info-icon {
        color: @text-color-secondary;
        font-size: 12px;
        flex-shrink: 0;
        cursor: help;
      }
    }

    .header-actions {
      display: var(--panel-hover, none);
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      margin-left: auto;

      :deep(.ant-btn) {
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
