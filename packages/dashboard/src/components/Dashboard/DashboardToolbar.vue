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
          <div :class="bem('field')">
            <div :class="bem('label')">自动刷新</div>
            <Select v-model:value="draftRefreshInterval" size="small" :disabled="isBooting" :options="refreshIntervalOptions" />
          </div>
          <div :class="bem('hint')">提示：自动刷新仅影响当前页面运行时；保存/导出时会写入 Dashboard JSON 的 refreshInterval。</div>
        </Card>

        <Card size="small" title="变量" :class="bem('card')">
          <div :class="bem('hint')">
            <div>更改将在点击底部“确定”后生效；仅当查询 expr 中使用了 <code>$变量名</code> 才会影响面板。</div>
            <div v-if="variableDefs.length > 0" :class="bem('var-help-list')">
              <div :class="bem('var-help-title')">当前仪表盘变量说明：</div>
              <div v-for="v in variableDefs" :key="v.id" :class="bem('var-help-item')">
                <div :class="bem('var-help-name')">
                  <code>{{ formatVariableToken(v.name) }}</code>
                  <span style="margin-left: 6px">{{ v.label || v.name }}</span>
                </div>
                <template v-for="(line, idx) in getVariableHelpLines(v)" :key="`${v.id}-${idx}`">
                  <div :class="bem('var-help-line')">- {{ line }}</div>
                </template>
              </div>
            </div>
          </div>

          <div v-if="variableDefs.length === 0" :class="bem('hint')">当前仪表盘未定义 variables。</div>

          <template v-else>
            <div v-if="isResolvingVariableOptions" :class="bem('hint')" style="margin-top: 0">选项加载中...</div>
            <div v-if="variableLastError" :class="bem('hint')" style="margin-top: 0">上次刷新失败：{{ variableLastError }}</div>

            <div v-for="v in variableDefs" :key="v.id" :class="bem('field')">
              <div :class="bem('var-label')" :title="v.label || v.name">{{ v.label || v.name }}</div>
              <div :class="bem('var-control')">
                <Select
                  v-if="isSelectLikeVariable(v)"
                  v-model:value="draftVariableValues[v.name]"
                  :mode="v.multi ? 'multiple' : undefined"
                  show-search
                  allow-clear
                  size="small"
                  style="width: 100%"
                  :disabled="isBooting || v.type === 'constant'"
                  :options="getVariableSelectOptions(v)"
                  :placeholder="getVariablePlaceholder(v)"
                />
                <Input
                  v-else
                  v-model:value="draftVariableValues[v.name]"
                  size="small"
                  allow-clear
                  style="width: 100%"
                  :disabled="isBooting || v.type === 'constant'"
                  :placeholder="v.type === 'constant' ? '常量' : '请输入'"
                />
              </div>
            </div>
          </template>
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
  import { Button, Card, Flex, Segmented, TimeRangePicker, Dropdown, Menu, Select, Input } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { MoreOutlined, DownloadOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore, useVariablesStore } from '/#/stores';
  import { message } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';
  import type { DashboardVariable, VariableOption } from '@grafana-fast/types';

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
  const variablesStore = useVariablesStore();

  const { currentDashboard, viewMode, isSaving, isBooting, isReadOnly } = storeToRefs(dashboardStore);
  const { variables: variableDefsRef, isResolvingOptions: isResolvingVariableOptions, lastError: variableLastError } = storeToRefs(variablesStore);

  const dashboardName = computed(() => currentDashboard.value?.name || '仪表盘');
  const isAllPanelsView = computed(() => viewMode.value === 'allPanels');

  const variableDefs = computed(() => variableDefsRef.value ?? []);
  const draftVariableValues = ref<Record<string, string | string[]>>({});

  const selectedTimeRange = ref('now-1h');
  const { timeRange, refreshInterval } = storeToRefs(timeRangeStore);

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
  const draftRefreshInterval = ref<number>(0);

  const isAllPanelsViewDraft = computed(() => draftViewMode.value === 'allPanels');

  const normalizeNonNegativeInt = (value: unknown, fallback: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  };

  const refreshIntervalOptions = computed(() => [
    { label: '关闭', value: 0 },
    { label: '5s', value: 5_000 },
    { label: '10s', value: 10_000 },
    { label: '30s', value: 30_000 },
    { label: '1m', value: 60_000 },
    { label: '5m', value: 300_000 },
    { label: '15m', value: 900_000 },
  ]);

  const resetSidebarDraft = () => {
    draftViewMode.value = isAllPanelsView.value ? 'allPanels' : 'grouped';
    draftTimeRange.value = selectedTimeRange.value || 'now-1h';
    draftRefreshInterval.value = normalizeNonNegativeInt(refreshInterval.value, 0);

    const next: Record<string, string | string[]> = {};
    const values = (variablesStore.state?.values ?? {}) as Record<string, unknown>;
    for (const v of variableDefs.value) {
      const name = String(v?.name ?? '').trim();
      if (!name) continue;
      next[name] = normalizeVariableValue(v, name in values ? values[name] : v.current);
    }
    draftVariableValues.value = next;
  };

  function isSameVariableValue(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => String(v) === String(b[i]));
    }
    if (Array.isArray(a) || Array.isArray(b)) return false;
    return String(a ?? '') === String(b ?? '');
  }

  function normalizeVariableValue(def: Pick<DashboardVariable, 'multi'> | undefined, value: unknown): string | string[] {
    const multi = !!def?.multi;
    if (multi) {
      if (Array.isArray(value)) return value.map((v) => String(v));
      const v = String(value ?? '').trim();
      return v ? [v] : [];
    }
    if (Array.isArray(value)) return String(value[0] ?? '');
    return String(value ?? '');
  }

  function isSelectLikeVariable(v: DashboardVariable): boolean {
    return v.type === 'select' || v.type === 'query';
  }

  function getVariableOptions(v: DashboardVariable): VariableOption[] {
    const name = String(v?.name ?? '').trim();
    if (!name) return [];
    const runtime = variablesStore.getOptions(name);
    if (Array.isArray(runtime) && runtime.length > 0) return runtime;
    return Array.isArray(v.options) ? v.options : [];
  }

  function getVariableSelectOptions(v: DashboardVariable): Array<{ label: string; value: string }> {
    return getVariableOptions(v).map((opt) => ({ label: String(opt.text ?? opt.value ?? ''), value: String(opt.value ?? opt.text ?? '') }));
  }

  function getVariablePlaceholder(v: DashboardVariable): string {
    if (v.type === 'query') return '请选择（query variable）';
    return '请选择';
  }

  function isDurationLikeValue(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    return /^[0-9]+[smhdwy]$/.test(v);
  }

  function isWindowLikeVariable(v: DashboardVariable): boolean {
    const name = String(v?.name ?? '').toLowerCase();
    const label = String(v?.label ?? '').toLowerCase();
    if (name === 'window' || name === 'interval' || name === 'range' || name === 'step') return true;
    if (label.includes('窗口') || label.includes('间隔') || label.includes('步长')) return true;
    const opts = Array.isArray(v.options) ? v.options : [];
    return opts.some((o) => isDurationLikeValue((o as any)?.value ?? (o as any)?.text));
  }

  function formatVariableToken(name: string): string {
    // UI 展示用：用 `$name` 表达变量引用（与插值层保持一致）
    return `$${name}`;
  }

  function getVariableHelpLines(v: DashboardVariable): string[] {
    const name = String(v?.name ?? '').trim();
    const token = name ? formatVariableToken(name) : '$变量名';
    const multi = !!v.multi;

    // window 类变量：强调和 timeRange 的区别 + 推荐用法
    if (isWindowLikeVariable(v)) {
      const example = name ? `rate(x[${token}])` : 'rate(x[$window])';
      return [
        `用途：用于 PromQL 的窗口（range vector），例如 ${example}；只影响每个点的统计窗口`,
        '区别：时间范围决定 from/to（展示多久）；窗口决定每个点往回看多久（平滑/降噪/口径）',
      ];
    }

    // select / query / input / constant：给出“替换形态 + 推荐写法”
    if (v.type === 'constant') {
      return [`常量：值固定（只读），用于 expr 中的 ${token}`];
    }

    if (v.type === 'input') {
      return [`输入：自由文本，直接替换到 expr 中的 ${token}`];
    }

    if (v.type === 'select' || v.type === 'query') {
      if (multi) {
        return [
          `多选：替换结果会是 a|b|c（regex join），推荐在标签过滤里用 ${name || 'label'}=~"${token}"`,
          v.type === 'query' ? '选项：点击弹窗“确定”后自动刷新（由后端/实现层返回）' : '选项：来自 Dashboard JSON 的静态 options',
        ];
      }
      return [
        `单选：直接替换为一个值，推荐在标签过滤里用 ${name || 'label'}="${token}"`,
        v.type === 'query' ? '选项：点击弹窗“确定”后自动刷新（由后端/实现层返回）' : '选项：来自 Dashboard JSON 的静态 options',
      ];
    }

    // 兜底：保证每个变量都有“含义对齐”说明
    return [`用法：在查询 expr 中使用 ${token}（支持 ${token} / \${${name || 'var'}} / [[${name || 'var'}]]）`];
  }

  const applySidebarDraft = () => {
    if (isBooting.value) return;
    dashboardStore.setViewMode(draftViewMode.value === 'allPanels' ? 'allPanels' : 'grouped');
    timeRangeStore.setTimeRange({ from: draftTimeRange.value, to: 'now' });
    timeRangeStore.setRefreshInterval(normalizeNonNegativeInt(draftRefreshInterval.value, 0));

    const patch: Record<string, string | string[]> = {};
    const currentValues = (variablesStore.state?.values ?? {}) as Record<string, unknown>;
    for (const v of variableDefs.value) {
      const name = String(v?.name ?? '').trim();
      if (!name) continue;
      if (!(name in draftVariableValues.value)) continue;
      const next = normalizeVariableValue(v, (draftVariableValues.value as any)[name]);
      const current = name in currentValues ? currentValues[name] : undefined;
      if (!isSameVariableValue(current, next)) patch[name] = next;
    }
    if (Object.keys(patch).length > 0) variablesStore.setValues(patch);

    // 约定：variables 的 query options 刷新不单独暴露按钮，跟随 Drawer 的“确定”动作触发。
    void variablesStore.resolveOptions();
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
    background-color: color-mix(in srgb, var(--gf-color-surface), transparent 8%);
    border-bottom: 1px solid var(--gf-color-border-muted);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    isolation: isolate;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--gf-color-primary-border-strong), transparent);
      opacity: 0.5;
      pointer-events: none;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      min-height: 48px;
      background-color: transparent;
      transition: background-color var(--gf-motion-normal) var(--gf-easing);

      &.dp-dashboard-toolbar__header--edit-mode {
        background-color: color-mix(in srgb, var(--gf-color-primary-soft), transparent 25%);
      }
    }

    &__title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--gf-color-text);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.5714285714285714;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    &__json-loading {
      padding: 24px;
      font-size: 14px;
      color: var(--gf-color-text-tertiary);
      line-height: 1.5714285714285714;
    }

    &__divider {
      width: 100%;
      height: 1px;
      background: var(--gf-color-border-muted);
      margin: 8px 0;
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
        gap: 16px;
      }

      .dp-dashboard-toolbar__sidebar-title {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 4px;
      }

      .dp-dashboard-toolbar__sidebar-name {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--gf-color-text);
        line-height: 1.5;
      }

      .dp-dashboard-toolbar__sidebar-subtitle {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--gf-color-text-secondary);
        font-size: 14px;
        line-height: 1.5714285714285714;
      }

      .dp-dashboard-toolbar__card {
        width: 100%;

        :deep(.gf-card__body) {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      }

      .dp-dashboard-toolbar__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .dp-dashboard-toolbar__field {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .dp-dashboard-toolbar__label {
        flex: 0 0 auto;
        width: 56px;
        font-size: 14px;
        color: var(--gf-color-text-secondary);
        line-height: 1.5714285714285714;
      }

      .dp-dashboard-toolbar__var-label {
        flex: 0 0 auto;
        width: 100px;
        font-size: 14px;
        color: var(--gf-color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.5714285714285714;
      }

      .dp-dashboard-toolbar__var-control {
        flex: 1 1 auto;
        min-width: 0;
      }

      .dp-dashboard-toolbar__var-help-list {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed var(--gf-color-border-muted);
      }

      .dp-dashboard-toolbar__var-help-title {
        font-size: 14px;
        line-height: 1.5714285714285714;
        color: var(--gf-color-text-secondary);
        margin-bottom: 8px;
        font-weight: 500;
      }

      .dp-dashboard-toolbar__var-help-item {
        margin-bottom: 12px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .dp-dashboard-toolbar__var-help-name {
        font-size: 14px;
        line-height: 1.5714285714285714;
        color: var(--gf-color-text);
        margin-bottom: 4px;

        code {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 13px;
          padding: 2px 6px;
          background: var(--gf-color-fill-tertiary);
          border-radius: var(--gf-radius-xs);
          color: var(--gf-color-primary);
        }
      }

      .dp-dashboard-toolbar__var-help-line {
        font-size: 13px;
        line-height: 1.6;
        color: var(--gf-color-text-tertiary);
        padding-left: 8px;
      }

      .dp-dashboard-toolbar__hint {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.6;
        color: var(--gf-color-text-tertiary);

        code {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          padding: 1px 4px;
          background: var(--gf-color-fill-tertiary);
          border-radius: var(--gf-radius-xs);
        }
      }
    }
  }
</style>
