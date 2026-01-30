<!--
	  文件说明：Dashboard 工具栏

	  职责：
	  - 视图切换（分组/全部面板）
	  - 时间范围选择（变更会触发可视面板刷新）
	  - 保存
	  - JSON 导入/导出（严格模式：非法 JSON 不会污染外部状态）
	-->
<template>
  <div :class="[bem(), bem({ sidebar: variant === 'sidebar' })]">
    <template v-if="variant === 'sidebar'">
      <div :class="bem('sidebar')">
        <div :class="bem('sidebar-title')">
          <div :class="bem('sidebar-name')">{{ dashboardName }}</div>
          <div :class="bem('sidebar-subtitle')">
            <span>{{ isAllPanelsView ? '全部面板（只读）' : '分组视图' }}</span>
          </div>
        </div>

        <Card size="small" title="视图" :class="bem('card')">
          <Segmented v-model:value="viewModeModel" block size="small" :options="viewModeOptions" :disabled="isBooting" />
          <div v-if="isAllPanelsView" :class="bem('hint')">提示：全部面板视图为只读，不支持拖拽/编辑。</div>
        </Card>

        <Card size="small" title="时间范围" :class="bem('card')">
          <div :class="bem('field')">
            <div :class="bem('label')">范围</div>
            <TimeRangePicker v-model:value="selectedTimeRange" :disabled="isBooting" @change="handleTimeRangeChange" />
          </div>
        </Card>

        <Card size="small" title="仪表盘" :class="bem('card')">
          <Flex gap="8" wrap>
            <Button size="small" type="primary" :loading="isSaving" :disabled="isBooting" @click="handleSave">保存</Button>
          </Flex>
        </Card>

        <Card size="small" title="JSON" :class="bem('card')">
          <Flex gap="8" wrap>
            <Button size="small" type="ghost" :icon="h(FileTextOutlined)" :disabled="isBooting" @click="handleViewJson">查看</Button>
            <Button size="small" type="ghost" :icon="h(UploadOutlined)" :disabled="isBooting" @click="handleImport">导入</Button>
            <Button size="small" type="ghost" :icon="h(DownloadOutlined)" :disabled="isBooting" @click="handleExport">导出</Button>
          </Flex>
          <div :class="bem('hint')">导入会先进行严格校验；非法 JSON 不会污染当前状态。</div>
        </Card>
      </div>
    </template>

    <template v-else>
      <!-- 单行：标题 + 操作区（旧头部形态） -->
      <div :class="bem('header')">
        <h2 :class="bem('title')">{{ dashboardName }}</h2>
        <div :class="bem('actions')">
          <!-- 视图切换：分组 <-> 全部面板（只读） -->
          <Button size="small" @click="handleTogglePanelsView" :disabled="isBooting">
            {{ isAllPanelsView ? '分组视图' : '全部面板' }}
          </Button>

          <!-- 时间范围选择器 -->
          <TimeRangePicker v-model:value="selectedTimeRange" :disabled="isBooting" @change="handleTimeRangeChange" />

          <Button size="small" @click="handleSave" type="primary" :loading="isSaving" :disabled="isBooting"> 保存 </Button>

          <Dropdown>
            <Button :icon="h(MoreOutlined)" size="small" :disabled="isBooting" />
            <template #overlay>
              <Menu
                :items="[
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
    </template>

    <!-- JSON 查看/编辑模态框 -->
    <Modal v-model:open="jsonModalVisible" title="仪表盘 JSON" :width="800" destroyOnClose :maskClosable="false">
      <DashboardJsonEditor
        ref="dashboardJsonEditorRef"
        v-model="dashboardJson"
        :read-only="jsonModalMode === 'view'"
        :validate="validateDashboardStrict"
        @validate="handleJsonValidate"
      />
      <template #footer>
        <Space>
          <Button @click="jsonModalVisible = false">取消</Button>
          <Button v-if="jsonModalMode === 'edit'" type="primary" @click="handleApplyJson" :disabled="!isJsonValid || isBooting"> 应用 </Button>
        </Space>
      </template>
    </Modal>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInputRef" type="file" accept=".json" style="display: none" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, h, watch } from 'vue';
  import { Button, Card, Flex, Modal, Segmented, Space, TimeRangePicker, Dropdown, Menu } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { MoreOutlined, DownloadOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore } from '/#/stores';
  import { message } from '@grafana-fast/component';
  import { DashboardJsonEditor } from '@grafana-fast/json-editor';
  import type { Dashboard } from '@grafana-fast/types';
  import { validateDashboardStrict } from '/#/utils/strictJsonValidators';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('dashboard-toolbar');

  const props = withDefaults(
    defineProps<{
      /** 展示形态：header=原头部样式；sidebar=侧边栏样式 */
      variant?: 'header' | 'sidebar';
    }>(),
    { variant: 'header' }
  );

  const variant = computed(() => props.variant ?? 'header');

  const dashboardStore = useDashboardStore();
  const timeRangeStore = useTimeRangeStore();

  const { currentDashboard, viewMode, isSaving, isBooting } = storeToRefs(dashboardStore);

  const dashboardName = computed(() => currentDashboard.value?.name || '仪表盘');
  const isAllPanelsView = computed(() => viewMode.value === 'allPanels');

  const selectedTimeRange = ref('now-1h');
  const { timeRange } = storeToRefs(timeRangeStore);

  // 外部可能通过 SDK/暴露 API 修改 timeRange：这里让 UI 始终反映 store 的真实值
  watch(
    () => String(timeRange.value.from ?? ''),
    (from) => {
      if (!from) return;
      selectedTimeRange.value = from;
    },
    { immediate: true }
  );

  // JSON 相关
  const jsonModalVisible = ref(false);
  const jsonModalMode = ref<'view' | 'edit'>('view');
  const dashboardJson = ref('');
  const isJsonValid = ref(true);
  const fileInputRef = ref<HTMLInputElement>();
  const dashboardJsonEditorRef = ref<null | {
    getDraftText: () => string;
    getDashboard: () => Dashboard;
  }>(null);

  const handleTimeRangeChange = (value: string) => {
    if (isBooting.value) return;
    timeRangeStore.setTimeRange({
      from: value,
      to: 'now',
    });
  };

  const viewModeOptions = computed(() => [
    { label: '分组视图', value: 'grouped', disabled: false },
    { label: '全部面板', value: 'allPanels', disabled: false },
  ]);

  const viewModeModel = computed({
    get: () => (isAllPanelsView.value ? 'allPanels' : 'grouped'),
    set: (value: string | number) => {
      if (isBooting.value) return;
      dashboardStore.setViewMode(String(value) === 'allPanels' ? 'allPanels' : 'grouped');
    },
  });

  const handleTogglePanelsView = () => {
    if (isBooting.value) return;
    dashboardStore.togglePanelsView();
  };

  const handleSave = async () => {
    if (isBooting.value) return;
    try {
      await dashboardStore.saveDashboard();
      message.success('保存成功');
    } catch (error) {
      console.error('保存失败', error);
    }
  };

  const handleMenuClick = ({ key }: { key: string | number }) => {
    switch (String(key)) {
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

  const handleExport = () => {
    if (isBooting.value) return;
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
    if (isBooting.value) return;
    fileInputRef.value?.click();
  };

  const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // 统一走 JSON 编辑器：非法 JSON 只在编辑器内部报错，不会污染外部状态
        const json = String(e.target?.result ?? '');
        dashboardJson.value = json;
        jsonModalMode.value = 'edit';
        jsonModalVisible.value = true;
        message.success('已加载 JSON，请检查并点击“应用”');
      } catch (error) {
        console.error('导入失败：JSON 格式错误', error);
      }
    };
    reader.readAsText(file);

    // 清空 input 值，以便可以重复导入同一个文件
    target.value = '';
  };

  const handleViewJson = () => {
    if (isBooting.value) return;
    if (!currentDashboard.value) {
      message.error('没有可查看的 Dashboard');
      return;
    }

    dashboardJson.value = JSON.stringify(currentDashboard.value, null, 2);
    jsonModalMode.value = 'view';
    jsonModalVisible.value = true;
  };

  const handleJsonValidate = (isValid: boolean) => {
    isJsonValid.value = isValid;
  };

  const handleApplyJson = () => {
    try {
      if (isBooting.value) return;
      const dashboard = dashboardJsonEditorRef.value?.getDashboard();
      if (!dashboard) {
        message.error('无法应用：Dashboard JSON 不合法');
        return;
      }
      const rawText = dashboardJsonEditorRef.value?.getDraftText?.() ?? dashboardJson.value;
      void dashboardStore.applyDashboardFromJson(dashboard, rawText);
      jsonModalVisible.value = false;
      message.success('应用成功');
    } catch (error) {
      console.error('应用失败：JSON 格式错误', error);
      message.error((error as Error)?.message ?? '应用失败');
    }
  };

  const openJsonModal = (mode: 'view' | 'edit' = 'view') => {
    if (isBooting.value) return;
    if (!currentDashboard.value) return;
    dashboardJson.value = JSON.stringify(currentDashboard.value, null, 2);
    jsonModalMode.value = mode;
    jsonModalVisible.value = true;
  };

  const closeJsonModal = () => {
    jsonModalVisible.value = false;
  };

  defineExpose({
    // Drawer / UI
    openJsonModal,
    closeJsonModal,
    // Actions (mirror toolbar capabilities)
    handleSave,
    handleTogglePanelsView,
    handleExport,
    handleImport,
    handleViewJson,
    handleApplyJson,
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
      padding: 8px 14px;
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
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    &--sidebar {
      position: static;
      top: auto;
      border-bottom: none;
      box-shadow: none;
      background-color: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      padding: 4px 0;

      &::after {
        display: none;
      }

      .dp-dashboard-toolbar__sidebar {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .dp-dashboard-toolbar__sidebar-title {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px 2px;
      }

      .dp-dashboard-toolbar__sidebar-name {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.2px;
        color: @text-color;
        line-height: 1.25;
      }

      .dp-dashboard-toolbar__sidebar-subtitle {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        color: color-mix(in srgb, @text-color, transparent 35%);
        font-size: 12px;
        line-height: 1.4;
      }

      .dp-dashboard-toolbar__card {
        width: 100%;
      }

      .dp-dashboard-toolbar__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .dp-dashboard-toolbar__field {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .dp-dashboard-toolbar__label {
        flex: 0 0 auto;
        width: 42px;
        font-size: 12px;
        color: color-mix(in srgb, @text-color, transparent 30%);
      }

      .dp-dashboard-toolbar__hint {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.5;
        color: color-mix(in srgb, @text-color, transparent 40%);
      }
    }
  }
</style>
