<!-- 数据查询标签页 - 支持 QueryBuilder 和手动 PromQL 两种模式 -->
<template>
  <div :class="bem()">
    <!-- 顶部操作栏 -->
    <div :class="bem('header')">
      <div :class="bem('controls')">
        <!-- 模式切换 -->
        <div :class="[bem('control-chip'), bem('control-chip--mode')]">
          <span :class="bem('chip-label')">模式</span>
          <Segmented
            :class="bem('mode-segmented')"
            :value="queryMode"
            :options="queryModeOptions"
            @update:value="(value: unknown) => (queryMode = value as QueryMode)"
          />
        </div>

        <!-- 查询解释开关 -->
        <div v-if="queryMode === 'builder'" :class="[bem('control-chip'), bem('control-chip--explain')]">
          <span :class="bem('chip-label')">解释</span>
          <Switch v-model:checked="showExplain" />
        </div>
      </div>

      <div :class="bem('header-actions')">
        <Button size="small" :class="bem('run-btn')" @click="handleExecuteQuery">
          <template #icon><SearchOutlined /></template>
          执行查询
        </Button>
      </div>
    </div>

    <!-- 查询列表 -->
    <div :class="bem('queries')">
      <div v-for="(draft, index) in queryDrafts" :key="draft.refId" :class="bem('query-item')">
        <div :class="bem('query-wrapper', { collapsed: draft.collapsed })">
          <!-- 查询标题区 - 点击标题区域折叠/展开 -->
          <div :class="bem('query-header')" @click="togglePanelCollapsed(index)">
            <div :class="bem('query-title')">
              <span :class="bem('query-collapse-icon', { expanded: !draft.collapsed })">
                <RightOutlined />
              </span>
              <span :class="bem('query-pill')">{{ draft.refId }}</span>
              <div :class="bem('query-text')">
                <div :class="bem('query-label')">查询 {{ draft.refId }}</div>
              </div>
              <Tag v-if="draft.hide" color="orange">已隐藏</Tag>
            </div>
            <div :class="bem('query-actions')" @click.stop>
              <div :class="bem('action-buttons')">
                <Tooltip :title="draft.hide ? '已隐藏，点击显示' : '可见，点击隐藏'">
                  <span :class="bem('action-icon')" style="color: #1677ff" @click="toggleQueryVisibility(index)">
                    <EyeInvisibleOutlined v-if="draft.hide" />
                    <EyeOutlined v-else />
                  </span>
                </Tooltip>

                <Tooltip v-if="queryMode === 'builder' && draft.builder.status === 'ok'" title="模版填充">
                  <span :class="bem('action-icon')" style="color: #fa8c16" @click="openQueryPatterns(index)">
                    <ThunderboltOutlined />
                  </span>
                </Tooltip>

                <Popconfirm v-if="queryDrafts.length > 1" title="确认删除该查询？" @confirm="removeQuery(index)">
                  <Tooltip title="删除查询">
                    <span :class="bem('action-icon')" style="color: #ff4d4f">
                      <DeleteOutlined />
                    </span>
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          </div>

          <!-- 查询内容区 -->
          <Transition name="fade-collapse">
            <div v-show="!draft.collapsed" :class="bem('query-content')">
              <!-- Dashboard variables helper (for template dashboards) -->
              <div v-if="availableVariables.length > 0" :class="bem('vars-bar')">
                <div :class="bem('vars-label')">变量</div>
                <div :class="bem('vars-list')">
                  <Button
                    v-for="v in availableVariables"
                    :key="v.id"
                    type="text"
                    size="small"
                    :class="bem('var-chip')"
                    :title="`${v.label || v.name} ($${v.name})`"
                    @click="handleUseVariable(index, v.name)"
                  >
                    ${{ v.name }}
                  </Button>
                </div>
                <div :class="bem('vars-hint')">
                  <template v-if="queryMode === 'code'">点击将追加到 PromQL 并复制</template>
                  <template v-else>点击复制，可粘贴到标签值/操作参数中</template>
                </div>
              </div>

              <!-- QueryBuilder 模式 -->
              <div v-if="queryMode === 'builder'" :class="bem('builder-mode')">
                <Space direction="vertical" :size="10" style="width: 100%">
                  <Alert
                    v-if="draft.builder.status !== 'ok'"
                    :type="draft.builder.issueType === 'syntax' ? 'error' : 'warning'"
                    show-icon
                    :message="
                      draft.builder.issueType === 'syntax'
                        ? `PromQL 语法错误（${draft.refId}）`
                        : `该 PromQL 无法完整转换为 Builder（${draft.refId}）`
                    "
                    :description="
                      [
                        draft.builder.message || '请在 Code 模式编辑该表达式；保存/执行仍将使用 Code 的 PromQL。',
                        formatDiagnostics(draft.builder.diagnostics),
                      ]
                        .filter(Boolean)
                        .join('；')
                    "
                  />

                  <template v-else>
                    <Alert
                      v-if="draft.builder.confidence && draft.builder.confidence !== 'exact' && !draft.builder.acceptedPartial"
                      type="warning"
                      show-icon
                      message="该 PromQL 只能部分转换为 Builder（当前仅预览）"
                    >
                      <template #description>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
                          <span>点击“接受转换”后才能编辑，并会用 Builder 生成的 PromQL 覆盖当前表达式（未识别片段将被过滤）。</span>
                          <Button size="small" type="primary" @click="acceptPartialConversion(index)">接受转换</Button>
                        </div>
                      </template>
                    </Alert>

                    <!-- 指标选择 -->
                    <div
                      :class="[
                        bem('builder-sections'),
                        {
                          [bem('builder-sections--readonly')]:
                            draft.builder.confidence && draft.builder.confidence !== 'exact' && !draft.builder.acceptedPartial,
                        },
                      ]"
                    >
                      <div :class="[bem('section'), bem('section--metric')]">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">指标</span>
                        </div>
                        <div :class="bem('section-content')">
                          <MetricSelector :class="bem('metric-selector')" v-model="draft.builder.visualQuery.metric" :datasource="effectiveDatasource" />
                        </div>
                      </div>

                      <!-- 标签过滤器 -->
                      <div :class="[bem('section'), bem('section--filters')]">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">标签过滤</span>
                        </div>
                        <div :class="bem('section-content')">
                          <LabelFilters
                            :class="bem('label-filters')"
                            v-model="draft.builder.visualQuery.labels"
                            :metric="draft.builder.visualQuery.metric"
                            :datasource="effectiveDatasource"
                          />
                        </div>
                      </div>

                      <!-- 操作列表 -->
                      <div :class="[bem('section'), bem('section--operations')]">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">操作</span>
                        </div>
                        <div :class="bem('section-content')">
                          <OperationsList
                            :class="bem('operations-list')"
                            v-model="draft.builder.visualQuery.operations"
                            :currentQuery="draft.builder.visualQuery"
                            :datasource="effectiveDatasource"
                            :highlighted-index="highlightedOpIndex"
                            @query-update="handleBuilderQueryUpdate(index, $event)"
                          />
                        </div>
                      </div>

                      <!-- 二元查询 -->
                      <div
                        v-if="draft.builder.visualQuery.binaryQueries && draft.builder.visualQuery.binaryQueries.length > 0"
                        :class="[bem('section'), bem('section--binary')]"
                      >
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">二元查询</span>
                        </div>
                        <div :class="bem('section-content')">
                          <NestedQueryList
                            :class="bem('nested-query-list')"
                            :query="draft.builder.visualQuery"
                            :datasource="effectiveDatasource"
                            @update="handleNestedQueryUpdate(index, $event)"
                          />
                        </div>
                      </div>

                      <!-- 查询提示 -->
                      <div v-if="draft.builder.visualQuery.metric" :class="[bem('section'), bem('section--hints')]">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">查询提示</span>
                        </div>
                        <div :class="bem('section-content')">
                          <QueryHints
                            :class="bem('query-hints')"
                            :query="draft.builder.visualQuery"
                            :datasource="effectiveDatasource"
                            @apply-fix="handleApplyFix(index, $event)"
                          />
                        </div>
                      </div>

                      <!-- 查询预览 -->
                      <div :class="bem('section')">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">查询预览</span>
                          <Button size="small" type="text" :icon="h(CopyOutlined)" :class="bem('section-copy-btn')" @click="handleCopyPreview(index)">
                            复制
                          </Button>
                        </div>
                        <div :class="bem('section-content')">
                          <QueryPreview :class="bem('query-preview')" :promql="getPromQLForDraft(draft)" :show-copy-button="false" />
                        </div>
                      </div>

                      <!-- 查询解释 -->
                      <div v-if="showExplain && draft.builder.visualQuery.metric" :class="bem('section')">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">查询解释</span>
                        </div>
                        <div :class="bem('section-content')">
                          <QueryExplain :class="bem('query-explain')" :query="draft.builder.visualQuery" @highlight="handleHighlightOperation" />
                        </div>
                      </div>

                      <Alert
                        v-if="draft.builder.parseWarnings && draft.builder.parseWarnings.length > 0"
                        type="warning"
                        show-icon
                        message="部分 PromQL 片段未能反解析为 Builder，已过滤"
                        :description="formatParseWarnings(draft.builder.parseWarnings)"
                      />
                    </div>
                  </template>
                </Space>
              </div>

              <!-- PromQL 代码模式 -->
              <div v-else :class="bem('code-mode')">
                <div :class="bem('code-grid')">
                  <FormItem :class="bem('code-item', 'wide')" label="PromQL 表达式">
                    <Textarea
                      v-model:value="draft.code.expr"
                      placeholder="例如：cpu_usage"
                      :rows="3"
                      @input="handleCodeExprInput(index)"
                      @change="handleCodeExprChange(index)"
                    />
                  </FormItem>

                  <FormItem :class="bem('code-item')" label="图例格式">
                    <Input v-model:value="draft.code.legendFormat" placeholder="例如：{{instance}}" />
                  </FormItem>

                  <FormItem :class="bem('code-item')" label="最小步长（秒）">
                    <InputNumber v-model:value="draft.code.minStep" :min="1" :max="300" style="width: 100%" />
                  </FormItem>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 添加查询按钮 -->
      <Button size="small" type="primary" :class="bem('add-btn')" block @click="addQuery">
        <template #icon><PlusOutlined /></template>
        添加查询
      </Button>
    </div>

    <!-- 查询模板弹窗 -->
    <QueryPatternsModal v-model:open="patternsModalOpen" @select="handlePatternSelect" />
  </div>
</template>

<script setup lang="ts">
  import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import {
    Alert,
    Button,
    FormItem,
    Input,
    InputNumber,
    message,
    Popconfirm,
    Segmented,
    Space,
    Switch,
    Tag,
    Textarea,
    Tooltip,
  } from '@grafana-fast/component';
  import {
    CopyOutlined,
    DeleteOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    PlusOutlined,
    RightOutlined,
    SearchOutlined,
    ThunderboltOutlined,
  } from '@ant-design/icons-vue';
  import MetricSelector from '/#/components/QueryBuilder/MetricSelector.vue';
  import LabelFilters from '/#/components/QueryBuilder/LabelFilters.vue';
  import OperationsList from '/#/components/QueryBuilder/query-builder/OperationsList.vue';
  import NestedQueryList from '/#/components/QueryBuilder/query-builder/NestedQueryList.vue';
  import QueryHints from '/#/components/QueryBuilder/query-builder/QueryHints.vue';
  import QueryPreview from '/#/components/QueryBuilder/QueryPreview.vue';
  import QueryExplain from '/#/components/QueryBuilder/query-builder/QueryExplain.vue';
  import QueryPatternsModal from '/#/components/QueryBuilder/QueryPatternsModal.vue';
  import { createNamespace, debounceCancellable } from '/#/utils';
  import type { CanonicalQuery, Datasource, PromVisualQuery } from '@grafana-fast/types';
  import { useVariablesStore } from '/#/stores';
  import { useApiClient } from '/#/runtime/useInjected';

  import {
    appendTokenToExpr,
    formatDiagnostics,
    formatParseWarnings,
    getPromQLForDraft,
    normalizeDatasourceType,
    normalizeVariableToken,
  } from './dataQueryTab/helpers';
  import type { QueryMode } from './dataQueryTab/types';
  import { useDataQueryTabDraftLifecycle } from './dataQueryTab/useDataQueryTabDraftLifecycle';

  const [_, bem] = createNamespace('data-query-tab');

  const variablesStore = useVariablesStore();
  const availableVariables = computed(() => variablesStore.variables ?? []);

  interface Props {
    queries?: CanonicalQuery[];
    datasource?: Pick<Datasource, 'id' | 'type' | 'name'> | null;
    /**
     * 可选：session key，用于强制重新初始化
     * - 当面板编辑器切换到另一个 panel 时，父组件应改变该值
     * - 在支持外部 reset 的同时，避免出现“props 更新环”的问题
     */
    sessionKey?: string | number;
  }

  const props = withDefaults(defineProps<Props>(), {
    queries: () => [],
  });

  const emit = defineEmits<{
    'update:queries': [queries: CanonicalQuery[]];
    execute: [];
  }>();

  const queryMode = ref<QueryMode>('builder');
  const queryModeOptions = [
    { label: 'QueryBuilder', value: 'builder' },
    { label: 'Code', value: 'code' },
  ] as const;
  const showExplain = ref(false);
  const patternsModalOpen = ref(false);
  const currentPatternQueryIndex = ref<number>(0);
  const highlightedOpIndex = ref<number>();
  const api = useApiClient();

  const inferredDatasourceFromQueries = computed<Pick<Datasource, 'id' | 'type' | 'name'> | null>(() => {
    const list = Array.isArray(props.queries) ? props.queries : [];
    for (const q of list) {
      const ref = (q as any)?.datasourceRef as { type?: unknown; uid?: unknown } | undefined;
      const uid = String(ref?.uid ?? '').trim();
      const type = String(ref?.type ?? '').trim();
      if (!uid || !type) continue;
      return { id: uid, type: type as any, name: uid };
    }
    return null;
  });

  const defaultDatasource = ref<Pick<Datasource, 'id' | 'type' | 'name'> | null>(null);
  const isLoadingDefaultDatasource = ref(false);
  const defaultDatasourceError = ref<string | null>(null);
  let defaultDatasourceReqToken = 0;

  const effectiveDatasource = computed<Pick<Datasource, 'id' | 'type' | 'name'> | null>(() => {
    return props.datasource ?? inferredDatasourceFromQueries.value ?? defaultDatasource.value;
  });

  const hasEffectiveDatasource = computed(() => {
    const id = String(effectiveDatasource.value?.id ?? '').trim();
    return !!id;
  });

  const loadDefaultDatasourceIfNeeded = async () => {
    if (props.datasource?.id) return;
    if (inferredDatasourceFromQueries.value?.id) return;
    if (defaultDatasource.value?.id) return;
    if (isLoadingDefaultDatasource.value) return;

    const token = (defaultDatasourceReqToken = defaultDatasourceReqToken + 1);
    isLoadingDefaultDatasource.value = true;
    defaultDatasourceError.value = null;
    try {
      const ds = await api.datasource.getDefaultDatasource();
      if (token !== defaultDatasourceReqToken) return;
      const id = String(ds?.id ?? '').trim();
      if (!id) {
        throw new Error('Default datasource response missing required field: id');
      }
      const type = normalizeDatasourceType((ds as any)?.type);
      const name = String((ds as any)?.name ?? '').trim();
      if (!name) {
        throw new Error('Default datasource response missing required field: name');
      }
      defaultDatasource.value = { id, type, name };
    } catch (error) {
      if (token !== defaultDatasourceReqToken) return;
      defaultDatasource.value = null;
      const msg = error instanceof Error ? error.message : String(error);
      defaultDatasourceError.value = msg;
      message.error({ content: `默认数据源获取失败：${msg}`, key: 'datasource:default', duration: 3 });
    } finally {
      if (token === defaultDatasourceReqToken) isLoadingDefaultDatasource.value = false;
    }
  };

  const clearHighlightedOp = debounceCancellable(() => {
    highlightedOpIndex.value = undefined;
  }, 2000);

  onBeforeUnmount(() => {
    clearHighlightedOp.cancel();
  });

  const {
    queryDrafts,
    togglePanelCollapsed,
    toggleQueryVisibility,
    markCodeEdited,
    addQuery,
    removeQuery,
    applyPatternToCurrentDraft,
    updateNestedQuery,
    updateBuilderQuery,
    acceptPartialConversion,
    validateDrafts,
    convertDraftsToCanonical,
    markEmitted,
  } = useDataQueryTabDraftLifecycle({
    queryMode,
    datasource: () => effectiveDatasource.value,
    getQueriesProp: () => props.queries,
    getSessionKey: () => props.sessionKey,
    emitUpdateQueries: (queries) => emit('update:queries', queries),
  });

  onMounted(() => {
    void loadDefaultDatasourceIfNeeded();
  });

  watch(
    () => [props.datasource?.id, inferredDatasourceFromQueries.value?.id],
    () => {
      void loadDefaultDatasourceIfNeeded();
    },
    { immediate: true }
  );

  const handleCodeExprInput = (index: number) => {
    markCodeEdited(index);
  };

  const handleCodeExprChange = (_index: number) => {
    // 预留：后续可在这里接入校验/格式化逻辑
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleUseVariable = async (index: number, name: string) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    const token = normalizeVariableToken(name);
    if (!token) return;

    // Code 模式：直接插入到 expr（末尾），并同步 builder 状态（避免继续使用旧 Builder PromQL）
    if (queryMode.value === 'code') {
      d.code.expr = appendTokenToExpr(d.code.expr ?? '', token);
      markCodeEdited(index);
    }

    const ok = await copyToClipboard(token);
    if (ok) {
      message.success(`已复制：${token}`);
    } else {
      // clipboard 失败时，至少给用户可见提示（用户仍可手动输入 $var）
      message.info(`变量：${token}`);
    }
  };

  const openQueryPatterns = (index: number) => {
    currentPatternQueryIndex.value = index;
    patternsModalOpen.value = true;
  };

  const handlePatternSelect = (query: PromVisualQuery) => {
    applyPatternToCurrentDraft(currentPatternQueryIndex.value, query);
    patternsModalOpen.value = false;
  };

  const handleApplyFix = (_index: number, fix: any) => {
    if (fix && typeof fix === 'function') fix();
  };

  const handleHighlightOperation = (index: number | null) => {
    highlightedOpIndex.value = index ?? undefined;
    clearHighlightedOp.cancel();
    if (index !== null) clearHighlightedOp();
  };

  const handleNestedQueryUpdate = (index: number, updatedQuery: PromVisualQuery) => {
    updateNestedQuery(index, updatedQuery);
  };

  const handleBuilderQueryUpdate = (index: number, updatedQuery: PromVisualQuery) => {
    updateBuilderQuery(index, updatedQuery);
  };

  const handleCopyPreview = async (index: number) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    const promql = getPromQLForDraft(draft);
    if (!promql) {
      message.warning('没有可复制的查询');
      return;
    }
    const ok = await copyToClipboard(promql);
    if (ok) message.success('已复制到剪贴板');
    else message.error('复制失败');
  };

  const handleExecuteQuery = () => {
    if (!hasEffectiveDatasource.value) {
      const msg = defaultDatasourceError.value
        ? `默认数据源获取失败：${defaultDatasourceError.value}`
        : isLoadingDefaultDatasource.value
          ? '默认数据源加载中，请稍后重试'
          : '缺少数据源，无法执行查询';
      message.error(msg);
      return;
    }

    const v = validateDrafts('execute');
    if (!v.ok) {
      const first = v.errors[0];
      if (first) {
        const idx = queryDrafts.value.findIndex((d) => d.refId === first.refId);
        if (idx >= 0) queryDrafts.value[idx]!.collapsed = false;
      }
      for (const e of v.errors) {
        message.error(`查询 ${e.refId}: ${e.message}`);
      }
      return;
    }

    const next = convertDraftsToCanonical('execute');
    markEmitted(next);
    emit('update:queries', next);
    emit('execute');
  };

  defineExpose({
    getQueries: () => convertDraftsToCanonical('save'),
    validateAndGetQueriesForSave: () => {
      if (!hasEffectiveDatasource.value) {
        const msg = defaultDatasourceError.value
          ? `默认数据源获取失败：${defaultDatasourceError.value}`
          : isLoadingDefaultDatasource.value
            ? '默认数据源加载中，请稍后重试'
            : '缺少数据源，无法保存查询';
        return { ok: false, errors: [{ refId: queryDrafts.value[0]?.refId ?? 'A', message: msg }], queries: [] };
      }
      const v = validateDrafts('save');
      return { ...v, queries: v.ok ? convertDraftsToCanonical('save') : [] };
    },
    validateAndGetQueriesForExecute: () => {
      if (!hasEffectiveDatasource.value) {
        const msg = defaultDatasourceError.value
          ? `默认数据源获取失败：${defaultDatasourceError.value}`
          : isLoadingDefaultDatasource.value
            ? '默认数据源加载中，请稍后重试'
            : '缺少数据源，无法执行查询';
        return { ok: false, errors: [{ refId: queryDrafts.value[0]?.refId ?? 'A', message: msg }], queries: [] };
      }
      const v = validateDrafts('execute');
      return { ...v, queries: v.ok ? convertDraftsToCanonical('execute') : [] };
    },
  });
</script>

<style scoped lang="less">
  .dp-data-query-tab {
    --dp-section-gap: 16px;
    --dp-inner-gap: 12px;
    --dp-card-radius: var(--gf-radius-lg);

    display: flex;
    flex-direction: column;
    gap: var(--dp-section-gap);
    color: var(--gf-color-text);
    padding: 0;

    // ===== 顶部操作栏 =====
    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      gap: 10px;
      flex-wrap: wrap;
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-md);
      border: 1px solid var(--gf-color-border-secondary);
    }

    &__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &__control-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
    }

    &__chip-label {
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    &__control-chip--mode {
      padding-right: 0;

      .dp-data-query-tab__chip-label {
        color: var(--gf-color-primary);
      }
    }

    &__control-chip--explain {
      min-width: auto;

      .dp-data-query-tab__chip-label {
        color: #fa8c16;
      }
    }

    &__mode-segmented {
      :deep(.gf-segmented) {
        padding: 2px;
        background: var(--gf-color-surface);
        border: 1px solid var(--gf-color-border-secondary);
      }

      :deep(.gf-segmented__item) {
        min-width: 90px;
        height: 26px;
        padding: 2px 12px;
        font-size: 12px;
        font-weight: 500;
      }
    }

    &__header-actions {
      display: inline-flex;
      align-items: center;
    }

    &__run-btn {
      height: 28px;
      padding: 0 12px;
      border-radius: var(--gf-radius-md);
      font-weight: 500;
      font-size: 12px;
      background: transparent;
      border: 1px dashed var(--gf-color-primary);
      color: var(--gf-color-primary);
      box-shadow: none;

      &:hover {
        background: var(--gf-color-primary-bg);
        border-style: solid;
      }
    }

    // ===== 查询列表区域 =====
    &__queries {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__add-btn {
      margin-top: 2px;
      height: 32px;
      font-weight: 500;
      font-size: 12px;
      border-radius: var(--gf-radius-md);
      border: 1px dashed var(--gf-color-border);
      background: transparent;
      color: var(--gf-color-text-secondary);
      transition: all var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-primary);
        color: var(--gf-color-primary);
        background: var(--gf-color-primary-bg);
        box-shadow: none;
      }
    }

    // ===== 单个查询项 =====
    &__query-item {
      width: 100%;

      // 每个查询的主题色
      --dp-query-accent: #1677ff;

      &:nth-child(6n + 1) {
        --dp-query-accent: #1677ff;
      }
      &:nth-child(6n + 2) {
        --dp-query-accent: #52c41a;
      }
      &:nth-child(6n + 3) {
        --dp-query-accent: #fa8c16;
      }
      &:nth-child(6n + 4) {
        --dp-query-accent: #722ed1;
      }
      &:nth-child(6n + 5) {
        --dp-query-accent: #13c2c2;
      }
      &:nth-child(6n + 6) {
        --dp-query-accent: #eb2f96;
      }
    }

    &__query-wrapper {
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
      border: 1px solid color-mix(in srgb, var(--dp-query-accent), transparent 60%);
      overflow: hidden;

      &.collapsed {
        .dp-data-query-tab__query-header {
          border-bottom: none;
        }
      }
    }

    &__query-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: color-mix(in srgb, var(--dp-query-accent), transparent 96%);
      border-bottom: 1px solid color-mix(in srgb, var(--dp-query-accent), transparent 80%);
      gap: 8px;
      cursor: pointer;
      user-select: none;
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: color-mix(in srgb, var(--dp-query-accent), transparent 92%);
      }
    }

    &__query-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    // 折叠箭头
    &__query-collapse-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      font-size: 9px;
      color: var(--gf-color-text-quaternary);
      transition: transform var(--gf-motion-fast) var(--gf-easing);
      flex-shrink: 0;

      &--expanded {
        transform: rotate(90deg);
      }
    }

    &__query-text {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    &__query-label {
      font-weight: 500;
      font-size: 12px;
      color: var(--gf-color-text);
    }

    &__query-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--gf-radius-xs);
      background: color-mix(in srgb, var(--dp-query-accent), transparent 88%);
      color: var(--dp-query-accent);
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
    }

    &__query-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    &__action-buttons {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      background: transparent;
    }

    // 图标操作按钮 - 直接用 span 包裹图标
    &__action-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 13px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      transition: all var(--gf-motion-fast) var(--gf-easing);
      opacity: 0.7;

      &:hover {
        opacity: 1;
        background: var(--gf-color-fill-secondary);
      }
    }

    // ===== 查询内容区 =====
    &__query-content {
      padding: 12px;
      background: var(--gf-color-surface);
    }

    // ===== 变量栏 =====
    &__vars-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px 8px;
      margin-bottom: 8px;
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-fill-quaternary);
      border: 1px dashed var(--gf-color-border-secondary);
    }

    &__vars-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--gf-color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    &__vars-list {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      min-width: 0;
    }

    &__var-chip.gf-button--type-text {
      height: 18px;
      padding: 0 6px;
      border-radius: var(--gf-radius-xs);
      border: 1px solid var(--gf-color-primary-border);
      background: var(--gf-color-primary-bg);
      color: var(--gf-color-primary);
      font-weight: 500;
      font-size: 10px;
      line-height: 16px;

      &:hover {
        background: var(--gf-color-primary-bg-hover);
      }
    }

    &__vars-hint {
      margin-left: auto;
      font-size: 10px;
      color: var(--gf-color-text-quaternary);
      white-space: nowrap;
    }

    // ===== Builder / Code 模式 =====
    &__builder-mode,
    &__code-mode {
      width: 100%;
    }

    &__builder-sections {
      display: flex;
      flex-direction: column;
      gap: var(--dp-inner-gap);
      width: 100%;

      &--readonly {
        pointer-events: none;
        opacity: 0.6;
      }
    }

    // ===== Section 样式（无包裹，纯标题+内容） =====
    &__section {
      width: 100%;
      background: transparent;
      border: none;
      border-radius: 0;
      overflow: visible;
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0 6px 0;
      background: transparent;
      border-bottom: none;
    }

    &__section-title {
      font-weight: 600;
      font-size: 11px;
      color: var(--gf-color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;

      // 小圆点标识
      &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--gf-color-text-quaternary);
        flex-shrink: 0;
      }

      .dp-data-query-tab__section--metric & {
        &::before {
          background: var(--gf-color-primary);
        }
      }

      .dp-data-query-tab__section--filters & {
        &::before {
          background: var(--gf-color-success);
        }
      }

      .dp-data-query-tab__section--operations & {
        &::before {
          background: var(--gf-color-warning);
        }
      }

      .dp-data-query-tab__section--binary & {
        &::before {
          background: #722ed1;
        }
      }

      .dp-data-query-tab__section--hints & {
        &::before {
          background: #13c2c2;
        }
      }
    }

    &__section-copy-btn.gf-button--type-text {
      --gf-btn-color: var(--gf-color-text-tertiary);
      --gf-btn-bg-hover: var(--gf-color-fill-secondary);
      --gf-btn-bg-active: var(--gf-color-fill-tertiary);
      height: 24px;
      padding: 0 8px;
      border-radius: var(--gf-radius-sm);
      font-size: 12px;
    }

    &__section-content {
      padding: 4px 0 0 0;
    }

    // ===== Code 模式 =====
    &__code-mode {
      background: var(--gf-color-fill-quaternary);
      border: none;
      border-radius: var(--gf-radius-md);
      padding: 14px;
    }

    &__code-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;

      @media (min-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    &__code-item--wide {
      grid-column: 1 / -1;
    }

    // ===== 子组件宽度 =====
    &__metric-selector,
    &__label-filters,
    &__operations-list,
    &__nested-query-list,
    &__query-hints,
    &__query-preview,
    &__query-explain {
      width: 100%;
    }
  }

  // ===== 过渡动画 =====
  .fade-collapse-enter-active,
  .fade-collapse-leave-active {
    transition: all var(--gf-motion-normal) var(--gf-easing);
  }

  .fade-collapse-enter-from,
  .fade-collapse-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
</style>
