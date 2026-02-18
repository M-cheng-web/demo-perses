<template>
  <div :class="bem()">
    <div :class="bem('sidebar')">
      <!-- 数据源模式 -->
      <div v-if="apiModeOptions?.length" :class="[bem('card'), bem('card--datasource')]">
        <div :class="bem('card-header')">
          <div :class="bem('card-icon')">
            <DatabaseOutlined />
          </div>
          <div :class="bem('card-title')">数据源模式</div>
        </div>
        <div :class="bem('card-body')">
          <Segmented
            :value="draftApiMode"
            block
            :options="apiModeOptions"
            :disabled="isBooting || apiModeSwitching"
            @update:value="(value: unknown) => (draftApiMode = value as 'remote' | 'mock')"
          />
          <div :class="bem('hint')">
            <InfoCircleOutlined :class="bem('hint-icon')" />
            <span>远程模式需要宿主提供 apiClient</span>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div :class="[bem('card'), bem('card--actions')]">
        <div :class="bem('card-header')">
          <div :class="bem('card-icon')">
            <ToolOutlined />
          </div>
          <div :class="bem('card-title')">操作</div>
        </div>
        <div :class="bem('card-body')">
          <div :class="bem('action-group')">
            <div :class="bem('action-label')">面板组</div>
            <Button type="primary" :disabled="isBooting || isReadOnly" @click="handleCreateGroup">
              <template #icon><PlusOutlined /></template>
              创建面板组
            </Button>
          </div>
          <div :class="bem('action-divider')"></div>
          <div :class="bem('action-group')">
            <div :class="bem('action-label')">JSON 配置</div>
            <div :class="bem('action-buttons')">
              <Tooltip title="查看当前 Dashboard JSON">
                <Button type="ghost" :icon="h(FileTextOutlined)" :disabled="isBooting" @click="handleViewJson">查看</Button>
              </Tooltip>
              <Tooltip title="导入 JSON 配置（以服务端校验为准）">
                <Button type="ghost" :icon="h(UploadOutlined)" :disabled="isBooting || isReadOnly" @click="handleImport">导入</Button>
              </Tooltip>
              <Tooltip title="导出当前配置为 JSON">
                <Button type="ghost" :icon="h(DownloadOutlined)" :disabled="isBooting" @click="handleExport">导出</Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- 视图与时间 -->
      <div :class="[bem('card'), bem('card--view')]">
        <div :class="bem('card-header')">
          <div :class="bem('card-icon')">
            <ClockCircleOutlined />
          </div>
          <div :class="bem('card-title')">视图与时间</div>
        </div>
        <div :class="bem('card-body')">
          <div :class="bem('field-group')">
            <div :class="bem('field-label')">视图模式</div>
            <Segmented
              :value="draftViewMode"
              block
              :options="viewModeOptions"
              :disabled="isBooting"
              @update:value="(value: unknown) => (draftViewMode = value as 'grouped' | 'allPanels')"
            />
            <Transition name="fade-slide">
              <div v-if="isAllPanelsViewDraft" :class="bem('field-warning')">
                <ExclamationCircleOutlined />
                <span>全部面板视图为只读模式</span>
              </div>
            </Transition>
          </div>
          <div :class="bem('field-row')">
            <div :class="bem('field-col')">
              <div :class="bem('field-label')">时间范围</div>
              <TimeRangePicker
                :value="draftTimeRange"
                :style="{ width: '100%' }"
                :disabled="isBooting"
                @update:value="(value: string) => (draftTimeRange = value)"
              />
            </div>
            <div :class="bem('field-col')">
              <div :class="bem('field-label')">自动刷新</div>
              <Select
                :value="draftRefreshInterval"
                :disabled="isBooting"
                :options="refreshIntervalOptions"
                @update:value="(value: unknown) => (draftRefreshInterval = Number(value ?? 0))"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 变量 -->
      <div :class="[bem('card'), bem('card--variables')]">
        <div :class="bem('card-header')">
          <div :class="bem('card-icon')">
            <CodeOutlined />
          </div>
          <div :class="bem('card-title')">变量</div>
          <div v-if="variableDefs.length > 0" :class="bem('card-badge')">{{ variableDefs.length }}</div>
        </div>
        <div :class="bem('card-body')">
          <!-- 无变量状态 -->
          <div v-if="variableDefs.length === 0" :class="bem('empty-state')">
            <div :class="bem('empty-icon')">
              <InboxOutlined />
            </div>
            <div :class="bem('empty-text')">当前仪表盘未定义变量</div>
          </div>

          <!-- 有变量时 -->
          <template v-else>
            <!-- 变量说明折叠面板 -->
            <div :class="bem('var-docs')">
              <div :class="bem('var-docs-header')" @click="toggleVarDocs">
                <QuestionCircleOutlined :class="bem('var-docs-icon')" />
                <span :class="bem('var-docs-title')">变量使用说明</span>
                <DownOutlined :class="[bem('var-docs-arrow'), { 'is-expanded': varDocsExpanded }]" />
              </div>
              <Transition name="expand">
                <div v-show="varDocsExpanded" :class="bem('var-docs-content')">
                  <div v-for="v in variableDefs" :key="v.id" :class="bem('var-doc-item')">
                    <div :class="bem('var-doc-header')">
                      <code :class="bem('var-doc-token')">{{ formatVariableToken(v.name) }}</code>
                      <span :class="bem('var-doc-name')">{{ v.label || v.name }}</span>
                    </div>
                    <div v-for="(line, idx) in getVariableHelpLines(v)" :key="`${v.id}-${idx}`" :class="bem('var-doc-line')">
                      {{ line }}
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- 加载/错误状态 -->
            <div v-if="isResolvingVariableOptions" :class="bem('var-status')">
              <LoadingOutlined spin :class="bem('var-status-icon')" />
              <span>选项加载中...</span>
            </div>
            <div v-if="variableLastError" :class="[bem('var-status'), bem('var-status--error')]">
              <WarningOutlined :class="bem('var-status-icon')" />
              <span>{{ variableLastError }}</span>
            </div>

            <!-- 变量列表 -->
            <div :class="bem('var-list')">
              <div v-for="v in variableDefs" :key="v.id" :class="bem('var-item')">
                <div :class="bem('var-item-label')">
                  <span :class="bem('var-item-name')" :title="v.label || v.name">{{ v.label || v.name }}</span>
                  <Tag v-if="v.type === 'constant'" :class="bem('var-item-tag')">常量</Tag>
                  <Tag v-else-if="v.multi" color="blue" :class="bem('var-item-tag')">多选</Tag>
                </div>
                <div :class="bem('var-item-control')">
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
  import { Button, Input, Segmented, Select, Tag, TimeRangePicker, Tooltip } from '@grafana-fast/component';
  import {
    ClockCircleOutlined,
    CodeOutlined,
    DatabaseOutlined,
    DownloadOutlined,
    DownOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    InboxOutlined,
    InfoCircleOutlined,
    LoadingOutlined,
    PlusOutlined,
    QuestionCircleOutlined,
    ToolOutlined,
    UploadOutlined,
    WarningOutlined,
  } from '@ant-design/icons-vue';
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

  const varDocsExpanded = ref(false);
  const toggleVarDocs = () => {
    varDocsExpanded.value = !varDocsExpanded.value;
  };

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
    return Array.isArray(runtime) ? runtime : [];
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
    padding: 0;

    &::after {
      display: none;
    }

    &__sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 0;
    }

    // ===== 卡片基础样式 =====
    &__card {
      position: relative;
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-lg);
      overflow: hidden;
      transition: box-shadow var(--gf-motion-normal) var(--gf-easing);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--gf-color-border);
        transition: background var(--gf-motion-normal) var(--gf-easing);
      }

      &:hover {
        box-shadow: 0 2px 8px color-mix(in srgb, var(--gf-color-text), transparent 94%);
      }

      // 不同类型卡片的左侧边条颜色
      &--datasource::before {
        background: linear-gradient(180deg, #722ed1 0%, #9254de 100%);
      }

      &--actions::before {
        background: linear-gradient(180deg, var(--gf-color-primary) 0%, #69b1ff 100%);
      }

      &--view::before {
        background: linear-gradient(180deg, #13c2c2 0%, #36cfc9 100%);
      }

      &--variables::before {
        background: linear-gradient(180deg, #fa8c16 0%, #ffc53d 100%);
      }
    }

    &__card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px 10px 16px;
    }

    &__card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-secondary);
      color: var(--gf-color-text-secondary);
      font-size: 14px;
      flex-shrink: 0;

      .dp-dashboard-toolbar__card--datasource & {
        background: color-mix(in srgb, #722ed1, transparent 88%);
        color: #722ed1;
      }

      .dp-dashboard-toolbar__card--actions & {
        background: var(--gf-color-primary-bg);
        color: var(--gf-color-primary);
      }

      .dp-dashboard-toolbar__card--view & {
        background: color-mix(in srgb, #13c2c2, transparent 88%);
        color: #13c2c2;
      }

      .dp-dashboard-toolbar__card--variables & {
        background: color-mix(in srgb, #fa8c16, transparent 88%);
        color: #fa8c16;
      }
    }

    &__card-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--gf-color-text-heading);
      line-height: 1.5;
      flex: 1;
    }

    &__card-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--gf-color-fill-tertiary);
      color: var(--gf-color-text-secondary);
      font-size: 12px;
      font-weight: 600;
    }

    &__card-body {
      padding: 0 16px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    // ===== 提示样式 =====
    &__hint {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-quaternary);
      font-size: 12px;
      line-height: 1.5;
      color: var(--gf-color-text-tertiary);
    }

    &__hint-icon {
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--gf-color-text-quaternary);
    }

    // ===== 操作区样式 =====
    &__action-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__action-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--gf-color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    &__action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    &__action-divider {
      width: 100%;
      height: 1px;
      background: var(--gf-color-border-secondary);
      margin: 4px 0;
    }

    // ===== 字段样式 =====
    &__field-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
      line-height: 1.5;
    }

    &__field-warning {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--gf-radius-md);
      background: color-mix(in srgb, var(--gf-color-warning), transparent 90%);
      color: var(--gf-color-warning);
      font-size: 12px;
      font-weight: 500;
    }

    &__field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    &__field-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    // ===== 空状态 =====
    &__empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      gap: 8px;
    }

    &__empty-icon {
      font-size: 32px;
      color: var(--gf-color-text-quaternary);
      opacity: 0.6;
    }

    &__empty-text {
      font-size: 13px;
      color: var(--gf-color-text-tertiary);
    }

    // ===== 变量文档折叠面板 =====
    &__var-docs {
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-quaternary);
      overflow: hidden;
    }

    &__var-docs-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      user-select: none;
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill-tertiary);
      }
    }

    &__var-docs-icon {
      color: var(--gf-color-text-quaternary);
      font-size: 14px;
    }

    &__var-docs-title {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
    }

    &__var-docs-arrow {
      color: var(--gf-color-text-quaternary);
      font-size: 12px;
      transition: transform var(--gf-motion-normal) var(--gf-easing);

      &.is-expanded {
        transform: rotate(180deg);
      }
    }

    &__var-docs-content {
      padding: 0 12px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__var-doc-item {
      padding: 10px 12px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
    }

    &__var-doc-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    &__var-doc-token {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      padding: 2px 8px;
      background: color-mix(in srgb, var(--gf-color-primary), transparent 88%);
      border-radius: var(--gf-radius-sm);
      color: var(--gf-color-primary);
      font-weight: 600;
    }

    &__var-doc-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text);
    }

    &__var-doc-line {
      font-size: 12px;
      line-height: 1.6;
      color: var(--gf-color-text-tertiary);
      padding-left: 4px;

      &::before {
        content: '•';
        margin-right: 6px;
        color: var(--gf-color-text-quaternary);
      }
    }

    // ===== 变量状态 =====
    &__var-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-quaternary);
      font-size: 13px;
      color: var(--gf-color-text-secondary);

      &--error {
        background: color-mix(in srgb, var(--gf-color-warning), transparent 90%);
        color: var(--gf-color-warning);
      }
    }

    &__var-status-icon {
      font-size: 14px;
    }

    // ===== 变量列表 =====
    &__var-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__var-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-fill-quaternary);
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill-tertiary);
      }
    }

    &__var-item-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__var-item-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--gf-color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__var-item-tag {
      flex-shrink: 0;
      font-size: 11px;
      padding: 0 6px;
      height: 18px;
      line-height: 18px;
    }

    &__var-item-control {
      width: 100%;
    }
  }

  // ===== 过渡动画 =====
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all var(--gf-motion-normal) var(--gf-easing);
  }

  .fade-slide-enter-from,
  .fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }

  .expand-enter-active,
  .expand-leave-active {
    transition: all var(--gf-motion-normal) var(--gf-easing);
    overflow: hidden;
  }

  .expand-enter-from,
  .expand-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
  }

  .expand-enter-to,
  .expand-leave-from {
    max-height: 500px;
  }
</style>
