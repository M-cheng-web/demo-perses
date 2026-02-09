<template>
  <div :class="bem()">
    <div :class="bem('sidebar')">
      <div v-if="apiModeOptions?.length" :class="bem('section')">
        <div :class="bem('section-header')">
          <div :class="bem('section-title')">数据源模式</div>
        </div>
        <div :class="bem('section-body')">
          <Alert type="info" show-icon :message="'更改将在点击底部“确定”后生效；远程模式需要宿主提供 apiClient。'" :class="bem('tip')" />
          <Segmented
            :value="draftApiMode"
            block
            :options="apiModeOptions"
            :disabled="isBooting || apiModeSwitching"
            @update:value="(value: unknown) => (draftApiMode = value as 'remote' | 'mock')"
          />
        </div>
      </div>

      <div :class="bem('section')">
        <div :class="bem('section-header')">
          <div :class="bem('section-title')">操作</div>
        </div>
        <div :class="bem('section-body')">
          <Flex gap="8" wrap>
            <Button type="ghost" :disabled="isBooting || isReadOnly" @click="handleCreateGroup">创建面板组</Button>
          </Flex>
          <div :class="bem('divider')"></div>
          <Flex gap="8" wrap>
            <Button type="ghost" :icon="h(FileTextOutlined)" :disabled="isBooting" @click="handleViewJson">查看</Button>
            <Button type="ghost" :icon="h(UploadOutlined)" :disabled="isBooting || isReadOnly" @click="handleImport">导入</Button>
            <Button type="ghost" :icon="h(DownloadOutlined)" :disabled="isBooting" @click="handleExport">导出</Button>
          </Flex>
          <Alert type="info" show-icon :message="'导入会先进行严格校验；非法 JSON 不会污染当前状态。'" :class="bem('tip')" />
        </div>
      </div>

      <div :class="bem('section')">
        <div :class="bem('section-header')">
          <div :class="bem('section-title')">视图与时间</div>
        </div>
        <div :class="bem('section-body')">
          <Alert type="info" show-icon :message="'更改将在点击底部“确定”后生效。'" :class="bem('tip')" />
          <Segmented
            :value="draftViewMode"
            block
            :options="viewModeOptions"
            :disabled="isBooting"
            @update:value="(value: unknown) => (draftViewMode = value as 'grouped' | 'allPanels')"
          />
          <Alert v-if="isAllPanelsViewDraft" type="warning" show-icon :message="'全部面板视图为只读，不支持拖拽/编辑。'" :class="bem('tip')" />
          <div :class="bem('field')">
            <div :class="bem('label')">范围</div>
            <TimeRangePicker
              :value="draftTimeRange"
              :style="{ width: '100%' }"
              :disabled="isBooting"
              @update:value="(value: string) => (draftTimeRange = value)"
            />
          </div>
          <div :class="bem('field')">
            <div :class="bem('label')">自动刷新</div>
            <Select
              :value="draftRefreshInterval"
              :disabled="isBooting"
              :options="refreshIntervalOptions"
              @update:value="(value: unknown) => (draftRefreshInterval = Number(value ?? 0))"
            />
          </div>
          <Alert
            type="info"
            show-icon
            :message="'自动刷新仅影响当前页面运行时；保存/导出时会写入 Dashboard JSON 的 refreshInterval。'"
            :class="bem('tip')"
          />
        </div>
      </div>

      <div :class="bem('section')">
        <div :class="bem('section-header')">
          <div :class="bem('section-title')">变量</div>
        </div>
        <div :class="bem('section-body')">
          <Alert type="info" show-icon :class="bem('tip')">
            <template #description> 更改将在点击底部“确定”后生效；仅当查询 expr 中使用了 <code>$变量名</code> 才会影响面板。 </template>
          </Alert>

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

          <Alert v-if="variableDefs.length === 0" type="info" show-icon :message="'当前仪表盘未定义 variables。'" :class="bem('tip')" />

          <template v-else>
            <Alert v-if="isResolvingVariableOptions" type="info" show-icon :message="'选项加载中...'" :class="bem('tip')" />
            <Alert v-if="variableLastError" type="warning" show-icon :message="`上次刷新失败：${variableLastError}`" :class="bem('tip')" />

            <div v-for="v in variableDefs" :key="v.id" :class="bem('field')">
              <div :class="bem('var-label')" :title="v.label || v.name">{{ v.label || v.name }}</div>
              <div :class="bem('var-control')">
                <Select
                  v-if="isSelectLikeVariable(v)"
                  :value="draftVariableValues[v.name]"
                  :mode="v.multi ? 'multiple' : undefined"
                  show-search
                  allow-clear
                  style="width: 100%"
                  :disabled="isBooting || v.type === 'constant'"
                  :options="getVariableSelectOptions(v)"
                  :placeholder="getVariablePlaceholder(v)"
                  @update:value="(value: string | string[] | undefined) => (draftVariableValues[v.name] = value ?? '')"
                />
                <Input
                  v-else
                  :value="formatPlainVariableDraftValue(draftVariableValues[v.name])"
                  allow-clear
                  style="width: 100%"
                  :disabled="isBooting || v.type === 'constant'"
                  :placeholder="v.type === 'constant' ? '常量' : '请输入'"
                  @update:value="(value: string | number) => (draftVariableValues[v.name] = parsePlainVariableDraftValue(v, value) ?? '')"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, computed, watch } from 'vue';
  import { storeToRefs } from '@grafana-fast/store';
  import { Alert, Button, Flex, Input, Segmented, Select, TimeRangePicker } from '@grafana-fast/component';
  import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons-vue';
  import { useDashboardStore, useTimeRangeStore, useVariablesStore } from '/#/stores';
  import { createNamespace } from '/#/utils';
  import type { DashboardVariable, VariableOption } from '@grafana-fast/types';

  const [_, bem] = createNamespace('dashboard-toolbar');

  const props = withDefaults(
    defineProps<{
      apiMode?: 'remote' | 'mock';
      apiModeOptions?: Array<{ label: string; value: 'remote' | 'mock'; disabled?: boolean }>;
      apiModeSwitching?: boolean;
    }>(),
    { apiMode: undefined, apiModeOptions: undefined, apiModeSwitching: false }
  );

  const emit = defineEmits<{
    (e: 'create-group'): void;
    (e: 'view-json'): void;
    (e: 'import-json'): void;
    (e: 'export-json'): void;
    (e: 'api-mode-change', mode: 'remote' | 'mock'): void;
  }>();

  const dashboardStore = useDashboardStore();
  const timeRangeStore = useTimeRangeStore();
  const variablesStore = useVariablesStore();

  const { viewMode, isBooting, isReadOnly } = storeToRefs(dashboardStore);
  const { variables: variableDefsRef, isResolvingOptions: isResolvingVariableOptions, lastError: variableLastError } = storeToRefs(variablesStore);

  const isAllPanelsView = computed(() => viewMode.value === 'allPanels');
  const variableDefs = computed(() => variableDefsRef.value ?? []);

  const draftVariableValues = ref<Record<string, string | string[]>>({});
  const selectedTimeRange = ref('now-1h');
  const { timeRange, refreshInterval } = storeToRefs(timeRangeStore);

  watch(
    () => String(timeRange.value.from ?? ''),
    (from) => {
      if (!from) return;
      selectedTimeRange.value = from;
    },
    { immediate: true }
  );

  const draftViewMode = ref<'grouped' | 'allPanels'>('grouped');
  const draftTimeRange = ref('now-1h');
  const draftRefreshInterval = ref<number>(0);
  const draftApiMode = ref<'remote' | 'mock'>('remote');

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
    draftApiMode.value = props.apiMode ?? draftApiMode.value;

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
    return opts.some((o) => isDurationLikeValue(o?.value ?? o?.text));
  }

  function formatVariableToken(name: string): string {
    return `$${name}`;
  }

  function getVariableHelpLines(v: DashboardVariable): string[] {
    const name = String(v?.name ?? '').trim();
    const token = name ? formatVariableToken(name) : '$变量名';
    const multi = !!v.multi;

    if (isWindowLikeVariable(v)) {
      const example = name ? `rate(x[${token}])` : 'rate(x[$window])';
      return [
        `用途：用于 PromQL 的窗口（range vector），例如 ${example}；只影响每个点的统计窗口`,
        '区别：时间范围决定 from/to（展示多久）；窗口决定每个点往回看多久（平滑/降噪/口径）',
      ];
    }

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

    return [`用法：在查询 expr 中使用 ${token}（支持 ${token} / \${${name || 'var'}} / [[${name || 'var'}]]）`];
  }

  const applySidebarDraft = () => {
    if (isBooting.value) return;
    if (props.apiModeOptions?.length && draftApiMode.value !== (props.apiMode ?? draftApiMode.value)) {
      emit('api-mode-change', draftApiMode.value);
    }
    dashboardStore.setViewMode(draftViewMode.value === 'allPanels' ? 'allPanels' : 'grouped');
    timeRangeStore.setTimeRange({ from: draftTimeRange.value, to: 'now' });
    timeRangeStore.setRefreshInterval(normalizeNonNegativeInt(draftRefreshInterval.value, 0));

    const patch: Record<string, string | string[]> = {};
    const currentValues = (variablesStore.state?.values ?? {}) as Record<string, unknown>;
    for (const v of variableDefs.value) {
      const name = String(v?.name ?? '').trim();
      if (!name) continue;
      if (!(name in draftVariableValues.value)) continue;
      const next = normalizeVariableValue(v, draftVariableValues.value[name]);
      const current = name in currentValues ? currentValues[name] : undefined;
      if (!isSameVariableValue(current, next)) patch[name] = next;
    }
    if (Object.keys(patch).length > 0) variablesStore.setValues(patch);

    void variablesStore.resolveOptions();
  };

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

  const handleCreateGroup = () => {
    if (isBooting.value) return;
    if (isReadOnly.value) return;
    emit('create-group');
  };

  const viewModeOptions = computed<Array<{ label: string; value: 'grouped' | 'allPanels'; disabled?: boolean }>>(() => [
    { label: '分组视图', value: 'grouped', disabled: false },
    { label: '全部面板', value: 'allPanels', disabled: false },
  ]);

  const formatPlainVariableDraftValue = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '');
  };

  const parsePlainVariableDraftValue = (def: DashboardVariable, value: string | number): string | string[] | undefined => {
    const text = String(value ?? '').trim();
    if (!def.multi) return text;
    if (!text) return [];
    return text
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
  };

  defineExpose({
    resetSidebarDraft,
    applySidebarDraft,
  });
</script>

<style lang="less">
  .dp-dashboard-toolbar {
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

    &__sidebar {
      display: flex;
      flex-direction: column;
      gap: 22px;
      padding: 0 2px 6px;
    }

    &__section {
      width: 100%;
      background: transparent;
      border: none;
      border-radius: 0;
    }

    &__section + &__section {
      padding-top: 16px;
      border-top: 1px solid var(--gf-color-border-secondary);
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 0;
      margin-bottom: 12px;
      background: transparent;
      border-bottom: none;
    }

    &__section-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--gf-color-text-heading);
      letter-spacing: 0;
      line-height: 1.5;
    }

    &__section-body {
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__section-body :deep(.gf-row) {
      row-gap: 8px;
    }

    &__divider {
      width: 100%;
      height: 1px;
      background: var(--gf-color-border-muted);
      margin: 8px 0;
      align-self: stretch;
    }

    &__field {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    &__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
      line-height: 1.5;
    }

    &__var-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.5;
    }

    &__var-control {
      width: 100%;
    }

    &__var-help-list {
      padding: 12px;
      border-radius: var(--gf-radius-md);
      border: 1px solid var(--gf-color-border-secondary);
      background: transparent;
    }

    &__var-help-title {
      font-size: 14px;
      line-height: 1.5714285714285714;
      color: var(--gf-color-text-secondary);
      margin-bottom: 8px;
      font-weight: 500;
    }

    &__var-help-item {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    &__var-help-name {
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

    &__var-help-line {
      font-size: 13px;
      line-height: 1.6;
      color: var(--gf-color-text-tertiary);
      padding-left: 0;
    }

    &__tip {
      margin: 0;
      border-radius: var(--gf-radius-md);

      :deep(.gf-alert) {
        padding: 6px 10px;
        border-radius: var(--gf-radius-md);
      }

      :deep(.gf-alert--info) {
        background: color-mix(in srgb, var(--gf-color-surface-muted), transparent 10%);
        border-color: var(--gf-color-border-secondary);
      }

      :deep(code) {
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        font-size: 12px;
        padding: 1px 4px;
        background: var(--gf-color-fill-tertiary);
        border-radius: var(--gf-radius-xs);
      }
    }
  }
</style>
