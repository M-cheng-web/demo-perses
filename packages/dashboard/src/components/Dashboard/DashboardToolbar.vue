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
        <Card size="small" title="操作" :class="bem('card')">
          <Flex gap="8" wrap>
            <Button size="small" type="ghost" :disabled="isBooting || isReadOnly" @click="handleCreateGroup">创建面板组</Button>
          </Flex>
          <div :class="bem('divider')"></div>
          <Flex gap="8" wrap>
            <Button size="small" type="ghost" :icon="h(FileTextOutlined)" :disabled="isBooting" @click="handleViewJson">查看</Button>
            <Button size="small" type="ghost" :icon="h(UploadOutlined)" :disabled="isBooting || isReadOnly" @click="handleImport">导入</Button>
            <Button size="small" type="ghost" :icon="h(DownloadOutlined)" :disabled="isBooting" @click="handleExport">导出</Button>
          </Flex>
          <div :class="bem('hint')">导入会先进行严格校验；非法 JSON 不会污染当前状态。</div>
        </Card>

        <Card size="small" title="视图与时间" :class="bem('card')">
          <div :class="bem('hint')">更改将在点击底部“确定”后生效。</div>
          <Segmented v-model:value="draftViewMode" block size="small" :options="viewModeOptions" :disabled="isBooting" />
          <div v-if="isAllPanelsViewDraft" :class="bem('hint')">提示：全部面板视图为只读，不支持拖拽/编辑。</div>
          <div :class="bem('field')">
            <div :class="bem('label')">范围</div>
            <TimeRangePicker v-model:value="draftTimeRange" :disabled="isBooting" />
          </div>
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

          <Button size="small" @click="handleSave" type="primary" :loading="isSaving" :disabled="isBooting || isReadOnly"> 保存 </Button>

          <Dropdown>
            <Button :icon="h(MoreOutlined)" size="small" :disabled="isBooting" />
            <template #overlay>
              <Menu
                :items="[
                  { key: 'export', label: '导出 JSON', icon: h(DownloadOutlined) },
                  { key: 'import', label: '导入 JSON', icon: h(UploadOutlined), disabled: isReadOnly },
                  { key: 'viewJson', label: '查看 JSON', icon: h(FileTextOutlined) },
                ]"
                @click="handleMenuClick"
              />
            </template>
          </Dropdown>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, h, watch } from 'vue';
  import { Button, Card, Flex, Segmented, TimeRangePicker, Dropdown, Menu } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { MoreOutlined, DownloadOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore } from '/#/stores';
  import { message } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('dashboard-toolbar');

  const props = withDefaults(
    defineProps<{
      /** 展示形态：header=原头部样式；sidebar=侧边栏样式 */
      variant?: 'header' | 'sidebar';
    }>(),
    { variant: 'header' }
  );

  const emit = defineEmits<{
    (e: 'create-group'): void;
    (e: 'view-json'): void;
    (e: 'import-json'): void;
    (e: 'export-json'): void;
  }>();

  const variant = computed(() => props.variant ?? 'header');

  const dashboardStore = useDashboardStore();
  const timeRangeStore = useTimeRangeStore();

  const { currentDashboard, viewMode, isSaving, isBooting, isReadOnly } = storeToRefs(dashboardStore);

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

  // ---------------------------
  // Sidebar draft (view & time)
  // ---------------------------
  const draftViewMode = ref<'grouped' | 'allPanels'>('grouped');
  const draftTimeRange = ref('now-1h');

  const isAllPanelsViewDraft = computed(() => draftViewMode.value === 'allPanels');

  const resetSidebarDraft = () => {
    draftViewMode.value = isAllPanelsView.value ? 'allPanels' : 'grouped';
    draftTimeRange.value = selectedTimeRange.value || 'now-1h';
  };

  const applySidebarDraft = () => {
    if (isBooting.value) return;
    dashboardStore.setViewMode(draftViewMode.value === 'allPanels' ? 'allPanels' : 'grouped');
    timeRangeStore.setTimeRange({ from: draftTimeRange.value, to: 'now' });
  };

  // JSON actions are handled by Dashboard.vue (single source of truth).
  const handleViewJson = () => {
    if (isBooting.value) return;
    emit('view-json');
  };

  const handleImport = () => {
    if (isBooting.value) return;
    emit('import-json');
  };

  const handleExport = () => {
    if (isBooting.value) return;
    emit('export-json');
  };

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

  const handleTogglePanelsView = () => {
    if (isBooting.value) return;
    dashboardStore.togglePanelsView();
  };

  const handleSave = async () => {
    if (isBooting.value) return;
    if (isReadOnly.value) {
      message.warning('当前为只读模式，无法保存');
      return;
    }
    try {
      await dashboardStore.saveDashboard();
      message.success('保存成功');
    } catch (error) {
      console.error('保存失败', error);
    }
  };

  const handleCreateGroup = () => {
    if (isBooting.value) return;
    if (isReadOnly.value) return;
    emit('create-group');
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

  defineExpose({
    resetSidebarDraft,
    applySidebarDraft,
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

    &__json-loading {
      padding: 24px;
      font-size: 13px;
      color: color-mix(in srgb, @text-color, transparent 40%);
    }

    &__divider {
      width: 100%;
      height: 1px;
      background: var(--gf-color-border-muted);
      margin: 2px 0;
      align-self: stretch;
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
