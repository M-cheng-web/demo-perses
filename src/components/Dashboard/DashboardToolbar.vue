<template>
  <div class="dashboard-toolbar">
    <!-- 第一层：标题和编辑模式按钮 -->
    <div class="toolbar-header" :class="{ 'edit-mode': isEditMode }">
      <h2 class="dashboard-title">{{ dashboardName }}</h2>
      <div class="toolbar-actions">
        <template v-if="isEditMode">
          <!-- 编辑模式下的操作按钮 -->
          <a-button @click="handleAddPanelGroup">
            <template #icon><PlusOutlined /></template>
            添加面板组
          </a-button>
          <a-button @click="handleSave" type="primary" :loading="isSaving"> 保存 </a-button>
          <a-button @click="handleToggleEditMode"> 取消 </a-button>
        </template>
        <template v-else>
          <a-button @click="handleToggleEditMode" type="primary"> 编辑 </a-button>
        </template>
      </div>
    </div>

    <!-- 第二层：变量选择器和控制按钮 -->
    <div class="toolbar-controls">
      <div class="controls-left">
        <VariableSelector :variables="currentDashboard?.variables" @change="handleVariableChange" />
      </div>
      <div class="controls-right">
        <!-- 时间范围选择器 -->
        <a-select v-model:value="selectedTimeRange" style="width: 160px" size="small" @change="handleTimeRangeChange">
          <a-select-option value="now-5m">最近 5 分钟</a-select-option>
          <a-select-option value="now-15m">最近 15 分钟</a-select-option>
          <a-select-option value="now-1h">最近 1 小时</a-select-option>
          <a-select-option value="now-6h">最近 6 小时</a-select-option>
          <a-select-option value="now-24h">最近 24 小时</a-select-option>
        </a-select>

        <!-- 刷新按钮 -->
        <a-button :icon="h(ReloadOutlined)" size="small" @click="handleRefresh" />

        <!-- 更多操作 -->
        <a-dropdown>
          <a-button :icon="h(MoreOutlined)" size="small" />
          <template #overlay>
            <a-menu @click="handleMenuClick">
              <a-menu-item key="manageVariables">
                <SettingOutlined />
                管理变量
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="export">
                <DownloadOutlined />
                导出 JSON
              </a-menu-item>
              <a-menu-item key="import">
                <UploadOutlined />
                导入 JSON
              </a-menu-item>
              <a-menu-item key="viewJson">
                <FileTextOutlined />
                查看 JSON
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- JSON 查看/编辑模态框 -->
    <a-modal v-model:open="jsonModalVisible" title="Dashboard JSON" :width="800" :footer="null">
      <JsonEditor v-model="dashboardJson" :height="500" :read-only="jsonModalMode === 'view'" @validate="handleJsonValidate" />
      <template #footer>
        <a-space>
          <a-button @click="jsonModalVisible = false">取消</a-button>
          <a-button v-if="jsonModalMode === 'edit'" type="primary" @click="handleApplyJson" :disabled="!isJsonValid"> 应用 </a-button>
        </a-space>
      </template>
    </a-modal>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInputRef" type="file" accept=".json" style="display: none" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, h, onUnmounted } from 'vue';
  import { storeToRefs } from 'pinia';
  import {
    ReloadOutlined,
    MoreOutlined,
    DownloadOutlined,
    UploadOutlined,
    FileTextOutlined,
    SettingOutlined,
    PlusOutlined,
  } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore } from '@/stores';
  import { message } from 'ant-design-vue';
  import JsonEditor from '@/components/Common/JsonEditor.vue';
  import VariableSelector from '@/components/Common/VariableSelector.vue';

  const dashboardStore = useDashboardStore();
  const timeRangeStore = useTimeRangeStore();

  const { currentDashboard, isEditMode, isSaving } = storeToRefs(dashboardStore);

  const dashboardName = computed(() => currentDashboard.value?.name || 'Dashboard');

  const selectedTimeRange = ref('now-1h');
  const autoRefreshInterval = ref(0);
  let autoRefreshTimer: number | null = null;

  // JSON 相关
  const jsonModalVisible = ref(false);
  const jsonModalMode = ref<'view' | 'edit'>('view');
  const dashboardJson = ref('');
  const isJsonValid = ref(true);
  const fileInputRef = ref<HTMLInputElement>();

  const handleTimeRangeChange = (value: string) => {
    timeRangeStore.setTimeRange({
      from: value,
      to: 'now',
    });
  };

  const handleRefresh = () => {
    timeRangeStore.refresh();
    message.success('已刷新');
  };

  const handleAutoRefreshChange = (interval: number) => {
    // 清除之前的定时器
    if (autoRefreshTimer !== null) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }

    // 设置新的定时器
    if (interval > 0) {
      autoRefreshTimer = window.setInterval(() => {
        timeRangeStore.refresh();
      }, interval * 1000);
      message.success(`已开启自动刷新，间隔 ${interval} 秒`);
    } else {
      message.info('已关闭自动刷新');
    }
  };

  const handleToggleEditMode = () => {
    dashboardStore.toggleEditMode();
  };

  const handleSave = async () => {
    try {
      await dashboardStore.saveDashboard();
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleAddPanelGroup = () => {
    dashboardStore.addPanelGroup({
      title: '新面板组',
      description: '',
    });
    message.success('已添加面板组');
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'manageVariables':
        handleManageVariables();
        break;
      case 'export':
        handleExport();
        break;
      case 'import':
        handleImport();
        break;
      case 'viewJson':
        handleViewJson();
        break;
    }
  };

  const handleVariableChange = (variables: Record<string, string | string[]>) => {
    console.log('Variables changed:', variables);
    // 可以在这里触发查询更新
    timeRangeStore.refresh();
  };

  const handleManageVariables = () => {
    message.info('变量管理功能（可以通过 JSON 编辑器编辑 Dashboard 来管理变量）');
    handleViewJson();
  };

  const handleExport = () => {
    if (!currentDashboard.value) {
      message.error('没有可导出的 Dashboard');
      return;
    }

    const json = JSON.stringify(currentDashboard.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${currentDashboard.value.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const handleImport = () => {
    fileInputRef.value?.click();
  };

  const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const dashboard = JSON.parse(json);

        // 验证 dashboard 格式
        if (!dashboard.name || !dashboard.panelGroups) {
          message.error('无效的 Dashboard JSON 格式');
          return;
        }

        dashboardStore.currentDashboard = dashboard;
        message.success('导入成功');
      } catch (error) {
        message.error('导入失败：JSON 格式错误');
      }
    };
    reader.readAsText(file);

    // 清空 input 值，以便可以重复导入同一个文件
    target.value = '';
  };

  const handleViewJson = () => {
    if (!currentDashboard.value) {
      message.error('没有可查看的 Dashboard');
      return;
    }

    dashboardJson.value = JSON.stringify(currentDashboard.value, null, 2);
    jsonModalMode.value = isEditMode.value ? 'edit' : 'view';
    jsonModalVisible.value = true;
  };

  const handleJsonValidate = (isValid: boolean) => {
    isJsonValid.value = isValid;
  };

  const handleApplyJson = () => {
    try {
      const dashboard = JSON.parse(dashboardJson.value);
      dashboardStore.currentDashboard = dashboard;
      jsonModalVisible.value = false;
      message.success('应用成功');
    } catch (error) {
      message.error('应用失败：JSON 格式错误');
    }
  };

  // 组件卸载时清除定时器
  onUnmounted(() => {
    if (autoRefreshTimer !== null) {
      clearInterval(autoRefreshTimer);
    }
  });
</script>

<style scoped lang="less">
  .dashboard-toolbar {
    background-color: @background-base;
    border-bottom: 1px solid @border-color;
  }

  // 第一层：标题栏
  .toolbar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: @background-base;
    transition: background-color 0.3s;

    &.edit-mode {
      background-color: fade(@primary-color, 15%);
    }

    .dashboard-title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: @text-color;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
  }

  // 第二层：控制栏
  .toolbar-controls {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 8px 16px 0;
    gap: 12px;

    .controls-left {
      flex: 1;
      min-width: 0;
      padding-bottom: 8px;
    }

    .controls-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 8px;
      margin-left: auto;
    }
  }
</style>
