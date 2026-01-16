<!--
  文件说明：Dashboard 工具栏

  职责：
  - 编辑模式开关/保存
  - 时间范围选择 + 手动刷新
  - 变量区展示与变更写回（variables store 与 dashboard JSON 同步）
  - JSON 导入/导出（导入时会走 schema migration）
-->
<template>
  <div :class="bem()">
    <!-- 第一层：标题和编辑模式按钮 -->
    <div :class="[bem('header'), bem('header', { 'edit-mode': isEditMode })]">
      <h2 :class="bem('title')">{{ dashboardName }}</h2>
      <div :class="bem('actions')">
        <template v-if="isEditMode">
          <!-- 编辑模式下的操作按钮 -->
          <Button @click="handleAddPanelGroup">
            <template #icon><PlusOutlined /></template>
            添加面板组
          </Button>
          <Button @click="handleSave" type="primary" :loading="isSaving"> 保存 </Button>
          <Button @click="handleToggleEditMode"> 取消 </Button>
        </template>
        <template v-else>
          <Button @click="handleToggleEditMode" type="primary"> 编辑 </Button>
        </template>
      </div>
    </div>

    <!-- 第二层：变量选择器和控制按钮 -->
    <div :class="bem('controls')">
      <div :class="bem('controls-left')">
        <VariableSelector :variables="resolvedVariables" @change="handleVariableChange" />
      </div>
      <div :class="bem('controls-right')">
        <!-- 时间范围选择器 -->
        <TimeRangePicker v-model:value="selectedTimeRange" @change="handleTimeRangeChange" />

        <!-- 刷新按钮 -->
        <Button :icon="h(ReloadOutlined)" size="small" @click="handleRefresh" />

        <!-- 更多操作 -->
        <Dropdown n>
          <Button :icon="h(MoreOutlined)" size="small" />
          <template #overlay>
            <Menu
              :items="[
                { key: 'manageVariables', label: '管理变量', icon: h(SettingOutlined) },
                { key: 'export', label: '导出 JSON', icon: h(DownloadOutlined) },
                { key: 'import', label: '导入 JSON', icon: h(UploadOutlined) },
                { key: 'viewJson', label: '查看 JSON', icon: h(FileTextOutlined) },
              ]"
              @click="handleMenuClick"
            />
          </template>
        </Dropdown>
      </div>
    </div>

    <!-- JSON 查看/编辑模态框 -->
    <Modal v-model:open="jsonModalVisible" title="Dashboard JSON" :width="800" destroyOnClose :maskClosable="false">
      <JsonEditor v-model="dashboardJson" :read-only="jsonModalMode === 'view'" @validate="handleJsonValidate" />
      <template #footer>
        <Space>
          <Button @click="jsonModalVisible = false">取消</Button>
          <Button v-if="jsonModalMode === 'edit'" type="primary" @click="handleApplyJson" :disabled="!isJsonValid"> 应用 </Button>
        </Space>
      </template>
    </Modal>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInputRef" type="file" accept=".json" style="display: none" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, h, onUnmounted } from 'vue';
  import { TimeRangePicker, Dropdown, Menu, Space, Modal } from '@grafana-fast/component';
  import { Button } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import {
    ReloadOutlined,
    MoreOutlined,
    DownloadOutlined,
    UploadOutlined,
    FileTextOutlined,
    SettingOutlined,
    PlusOutlined,
  } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore, useVariablesStore } from '/#/stores';
  import { message } from '@grafana-fast/component';
  import JsonEditor from '/#/components/Common/JsonEditor.vue';
  import VariableSelector from '/#/components/Common/VariableSelector.vue';
  import { createNamespace } from '/#/utils';
  import { migrateDashboard } from '@grafana-fast/types';

  const [_, bem] = createNamespace('dashboard-toolbar');

  const dashboardStore = useDashboardStore();
  const timeRangeStore = useTimeRangeStore();
  const variablesStore = useVariablesStore();

  const { currentDashboard, isEditMode, isSaving } = storeToRefs(dashboardStore);
  const { options: variableOptions } = storeToRefs(variablesStore as any);

  const dashboardName = computed(() => currentDashboard.value?.name || 'Dashboard');
  const resolvedVariables = computed(() => {
    const vars = currentDashboard.value?.variables ?? [];
    return vars.map((v) => ({
      ...v,
      options: variableOptions.value?.[v.name] ?? v.options,
    }));
  });

  const selectedTimeRange = ref('now-1h');
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

  const handleToggleEditMode = () => {
    dashboardStore.toggleEditMode();
  };

  const handleSave = async () => {
    try {
      await dashboardStore.saveDashboard();
      message.success('保存成功');
    } catch (error) {
      console.error('保存失败', error);
    }
  };

  const handleAddPanelGroup = () => {
    dashboardStore.addPanelGroup({
      title: '新面板组',
      description: '',
    });
    message.success('已添加面板组');
  };

  const handleMenuClick = ({ key }: { key: string | number }) => {
    switch (String(key)) {
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
    variablesStore.setValues(variables);
    // write back to Dashboard JSON for export/save
    variablesStore.applyToDashboard(currentDashboard.value ?? null);
    // Query refresh is handled by QueryScheduler/QueryRunner (scoped), no longer by global refresh().
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
        const dashboard = migrateDashboard(JSON.parse(json));

        // 验证 dashboard 格式
        if (!dashboard.name || !dashboard.panelGroups) {
          message.error('无效的 Dashboard JSON 格式');
          return;
        }

        dashboardStore.currentDashboard = dashboard;
        message.success('导入成功');
      } catch (error) {
        console.error('导入失败：JSON 格式错误', error);
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
      const dashboard = migrateDashboard(JSON.parse(dashboardJson.value));
      dashboardStore.currentDashboard = dashboard;
      jsonModalVisible.value = false;
      message.success('应用成功');
    } catch (error) {
      console.error('应用失败：JSON 格式错误', error);
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
  .dp-dashboard-toolbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background-color: color-mix(in srgb, @background-base, transparent 8%);
    border-bottom: 1px solid @border-color;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
    isolation: isolate;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--gf-color-primary-border-strong), transparent);
      opacity: 0.65;
      pointer-events: none;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px 10px;
      background-color: transparent;
      transition: background-color var(--gf-motion-normal) var(--gf-easing);

      &.dp-dashboard-toolbar__header--edit-mode {
        background-color: color-mix(in srgb, var(--gf-color-primary-soft), transparent 25%);
      }
    }

    &__title {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
      letter-spacing: 0.2px;
      color: @text-color;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    &__controls {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 0 14px 10px;
      gap: 12px;
    }

    &__controls-left {
      flex: 1;
      min-width: 0;
      padding-bottom: 8px;
    }

    &__controls-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 6px;
      margin-left: auto;
    }
  }
</style>
