<!-- 数据查询标签页 - 支持 QueryBuilder 和手动 PromQL 两种模式 -->
<template>
  <div :class="bem()">
    <!-- 顶部操作栏 -->
    <div :class="bem('header')">
      <div :class="bem('header-left')">
        <div :class="bem('title-block')">
          <div :class="bem('title')">数据查询</div>
          <div :class="bem('controls')">
            <!-- 模式切换 -->
            <div :class="bem('control-chip')">
              <span :class="bem('chip-label')">模式</span>
              <Tabs :class="bem('mode-tabs')" :activeKey="queryMode" @update:active-key="(key: string) => (queryMode = key as any)">
                <TabPane name="builder" tab="QueryBuilder" />
                <TabPane name="code" tab="Code" />
              </Tabs>
            </div>

            <!-- 查询解释开关 -->
            <div v-if="queryMode === 'builder'" :class="bem('control-chip')">
              <span :class="bem('chip-label')">解释</span>
              <Switch v-model:checked="showExplain" size="small" checked-children="开" un-checked-children="关" />
            </div>
          </div>
        </div>
      </div>

      <!-- 执行查询按钮 -->
      <div :class="bem('header-actions')">
        <Button type="primary" size="middle" :class="bem('run-btn')" @click="handleExecuteQuery">
          <template #icon><SearchOutlined /></template>
          执行查询
        </Button>
      </div>
    </div>

    <!-- 查询列表 -->
    <div :class="bem('queries')">
      <div v-for="(draft, index) in queryDrafts" :key="draft.refId" :class="bem('query-item')">
        <div :class="bem('query-wrapper', { collapsed: draft.collapsed })">
          <!-- 查询标题区 -->
          <div :class="bem('query-header')">
            <div :class="bem('query-title')">
              <span :class="bem('query-pill')">{{ draft.refId }}</span>
              <div :class="bem('query-text')">
                <div :class="bem('query-label')">查询 {{ draft.refId }}</div>
              </div>
              <Tag v-if="draft.hide" color="orange">已隐藏</Tag>
            </div>
            <div :class="bem('query-actions')">
              <div :class="bem('action-buttons')">
                <Tooltip :title="draft.hide ? '已隐藏，点击显示' : '可见，点击隐藏'">
                  <Button
                    icon-only
                    type="text"
                    size="small"
                    :class="bem('icon-btn')"
                    :icon="h(draft.hide ? EyeInvisibleOutlined : EyeOutlined)"
                    @click="toggleQueryVisibility(index)"
                  />
                </Tooltip>

                <Tooltip :title="draft.collapsed ? '展开' : '折叠'">
                  <Button
                    icon-only
                    type="text"
                    size="small"
                    :class="bem('icon-btn')"
                    :icon="h(draft.collapsed ? DownOutlined : UpOutlined)"
                    @click="togglePanelCollapsed(index)"
                  />
                </Tooltip>

                <Tooltip v-if="queryMode === 'builder' && draft.builder.status === 'ok'" title="模版填充">
                  <Button
                    icon-only
                    type="text"
                    size="small"
                    :class="bem('icon-btn')"
                    :icon="h(ThunderboltOutlined)"
                    @click="openQueryPatterns(index)"
                  />
                </Tooltip>

                <Popconfirm v-if="queryDrafts.length > 1" title="确认删除该查询？" @confirm="removeQuery(index)">
                  <Tooltip title="删除查询">
                    <Button icon-only danger type="text" size="small" :class="bem('icon-btn')" :icon="h(DeleteOutlined)" />
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
                          <MetricSelector :class="bem('metric-selector')" v-model="draft.builder.visualQuery.metric" :datasource="datasource" />
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
                            :datasource="datasource"
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
                            :datasource="datasource"
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
                            :datasource="datasource"
                            @update="handleNestedQueryUpdate(index, $event)"
                          />
                        </div>
                      </div>

                      <!-- 查询提示 -->
                      <QueryHints
                        v-if="draft.builder.visualQuery.metric"
                        :query="draft.builder.visualQuery"
                        :datasource="datasource"
                        @apply-fix="handleApplyFix(index, $event)"
                      />

                      <!-- 查询预览 -->
                      <div :class="bem('section')">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">查询预览</span>
                        </div>
                        <div :class="bem('section-content')">
                          <QueryPreview :class="bem('query-preview')" :promql="getPromQLForDraft(draft)" />
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
      <Button type="primary" :class="bem('add-btn')" block @click="addQuery">
        <template #icon><PlusOutlined /></template>
        添加查询
      </Button>
    </div>

    <!-- 查询模板弹窗 -->
    <QueryPatternsModal v-model:open="patternsModalOpen" @select="handlePatternSelect" />
  </div>
</template>

<script setup lang="ts">
  import { computed, h, onBeforeUnmount, ref } from 'vue';
  import {
    Alert,
    Button,
    FormItem,
    Input,
    InputNumber,
    message,
    Popconfirm,
    Space,
    Switch,
    TabPane,
    Tabs,
    Tag,
    Textarea,
    Tooltip,
  } from '@grafana-fast/component';
  import {
    DeleteOutlined,
    DownOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    PlusOutlined,
    SearchOutlined,
    ThunderboltOutlined,
    UpOutlined,
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

  import { formatDiagnostics, formatParseWarnings, getPromQLForDraft } from './dataQueryTab/helpers';
  import type { QueryMode } from './dataQueryTab/types';
  import { useQueryDrafts } from './dataQueryTab/useQueryDrafts';
  import { useQueryEmit } from './dataQueryTab/useQueryEmit';
  import { useQueryModeSync } from './dataQueryTab/useQueryModeSync';
  import { useQueryValidation } from './dataQueryTab/useQueryValidation';

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
    datasource: () => ({ id: 'prometheus-mock', type: 'prometheus', name: 'Prometheus' }),
  });

  const emit = defineEmits<{
    'update:queries': [queries: CanonicalQuery[]];
    execute: [];
  }>();

  const queryMode = ref<QueryMode>('builder');
  const showExplain = ref(false);
  const patternsModalOpen = ref(false);
  const currentPatternQueryIndex = ref<number>(0);
  const highlightedOpIndex = ref<number>();

  const clearHighlightedOp = debounceCancellable(() => {
    highlightedOpIndex.value = undefined;
  }, 2000);

  onBeforeUnmount(() => {
    clearHighlightedOp.cancel();
  });

  const {
    queryDrafts,
    resetFromProps,
    togglePanelCollapsed,
    toggleQueryVisibility,
    markCodeEdited,
    addQuery,
    removeQuery,
    applyPatternToCurrentDraft,
    updateNestedQuery,
    updateBuilderQuery,
    acceptPartialConversion,
  } = useQueryDrafts();

  useQueryModeSync({ queryMode, queryDrafts });

  const { validateDrafts, convertDraftsToCanonical } = useQueryValidation({
    queryMode,
    queryDrafts,
    getDatasource: () => props.datasource,
  });

  const { markEmitted } = useQueryEmit({
    getQueriesProp: () => props.queries,
    getSessionKey: () => props.sessionKey,
    queryDrafts,
    resetFromProps,
    convertDraftsToCanonical,
    emitUpdateQueries: (queries) => emit('update:queries', queries),
  });

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
    const token = `$${String(name ?? '').trim()}`;
    if (token === '$') return;

    // Code 模式：直接插入到 expr（末尾），并同步 builder 状态（避免继续使用旧 Builder PromQL）
    if (queryMode.value === 'code') {
      const cur = String(d.code.expr ?? '');
      const sep = cur && !/\s$/.test(cur) ? ' ' : '';
      d.code.expr = `${cur}${sep}${token}`;
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

  const handleExecuteQuery = () => {
    const v = validateDrafts('execute');
    if (!v.ok) {
      // 展开第一个错误项，帮助用户快速定位
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
      const v = validateDrafts('save');
      return { ...v, queries: v.ok ? convertDraftsToCanonical('save') : [] };
    },
    validateAndGetQueriesForExecute: () => {
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
    padding: 4px 0;

    // ===== 顶部操作栏 =====
    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--dp-card-radius);
      background: linear-gradient(135deg, var(--gf-color-surface) 0%, var(--gf-color-surface-muted) 100%);
      border: 1px solid var(--gf-color-border);
      box-shadow: var(--gf-shadow-1);
      gap: 16px;
      flex-wrap: wrap;
    }

    &__header-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      min-width: 0;
      flex: 1;
    }

    &__title-block {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    &__title {
      font-weight: 700;
      font-size: 16px;
      color: var(--gf-color-text-heading);
      letter-spacing: 0.02em;
      line-height: 1.4;
      white-space: nowrap;
    }

    &__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    &__control-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
    }

    &__chip-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--gf-color-text-secondary);
    }

    &__header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    &__run-btn {
      border-radius: var(--gf-radius-md);
      padding: 8px 20px;
      font-weight: 600;
      height: 36px;
      box-shadow: var(--gf-shadow-1);

      &:hover {
        box-shadow: var(--gf-shadow-2);
      }
    }

    // ===== 查询列表区域 =====
    &__queries {
      display: flex;
      flex-direction: column;
      gap: var(--dp-section-gap);
    }

    &__add-btn {
      margin-top: 4px;
      height: 40px;
      font-weight: 600;
      border-radius: var(--gf-radius-md);
      border: 2px dashed var(--gf-color-border);
      background: var(--gf-color-surface-muted);
      color: var(--gf-color-primary);
      transition: all var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-primary-border);
        background: var(--gf-color-primary-bg);
        box-shadow: none;
      }
    }

    // ===== 单个查询项 =====
    &__query-item {
      width: 100%;
    }

    &__query-wrapper {
      border-radius: var(--dp-card-radius);
      overflow: hidden;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      box-shadow: var(--gf-shadow-1);
      transition:
        box-shadow var(--gf-motion-fast) var(--gf-easing),
        border-color var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        box-shadow: var(--gf-shadow-2);
        border-color: var(--gf-color-border-strong);
      }

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
      padding: 12px 16px;
      background: linear-gradient(90deg, var(--gf-color-primary-bg) 0%, var(--gf-color-surface) 100%);
      border-bottom: 1px solid var(--gf-color-border-muted);
      gap: 16px;
    }

    &__query-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    &__query-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    &__query-label {
      font-weight: 600;
      font-size: 14px;
      color: var(--gf-color-text-heading);
    }

    &__query-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-primary);
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(22, 119, 255, 0.2);
    }

    &__query-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    &__action-buttons {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
    }

    &__icon-btn.gf-button--type-text.gf-button--icon-only:not(.gf-button--danger) {
      --gf-btn-color: var(--gf-color-text-tertiary);
      --gf-btn-bg-hover: var(--gf-color-fill-secondary);
      --gf-btn-bg-active: var(--gf-color-fill-tertiary);
      --gf-btn-shadow-hover: none;
      border-radius: var(--gf-radius-sm);
    }

    &__icon-btn.gf-button--type-text.gf-button--icon-only:not(.gf-button--danger):hover:not(.is-disabled) {
      --gf-btn-color: var(--gf-color-primary);
    }

    // ===== 查询内容区 =====
    &__query-content {
      padding: 16px;
      background: var(--gf-color-surface);
    }

    // ===== 变量栏 =====
    &__vars-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: var(--dp-inner-gap);
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
    }

    &__vars-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gf-color-text-secondary);
    }

    &__vars-list {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }

    &__var-chip.gf-button--type-text {
      height: 24px;
      padding: 0 10px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-color-primary-border);
      background: var(--gf-color-primary-bg);
      color: var(--gf-color-primary);
      font-weight: 600;
      font-size: 12px;

      &:hover {
        background: var(--gf-color-primary-bg-hover);
      }
    }

    &__vars-hint {
      margin-left: auto;
      font-size: 11px;
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

    // ===== Section 卡片样式 =====
    &__section {
      width: 100%;
      border-radius: var(--gf-radius-md);
      overflow: hidden;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border-muted);
      transition:
        border-color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        border-color: var(--gf-color-border);
      }

      // 不同区块的顶部强调色
      &--metric {
        border-top: 3px solid var(--gf-color-primary);
      }

      &--filters {
        border-top: 3px solid var(--gf-color-success);
      }

      &--operations {
        border-top: 3px solid var(--gf-color-warning);
      }

      &--binary {
        border-top: 3px solid #722ed1;
      }
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--gf-color-surface-muted);
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    &__section-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--gf-color-text-heading);
      line-height: 1.5;
    }

    &__section-content {
      padding: 14px;
    }

    // ===== Code 模式 =====
    &__code-mode {
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      padding: 16px;
    }

    &__mode-tabs {
      min-width: 180px;
      --gf-tabs-border: 1px solid var(--gf-color-border);
      --gf-tabs-radius: var(--gf-radius-md);
      --gf-tabs-bg: var(--gf-color-surface);
      --gf-tabs-nav-padding: 3px;
      --gf-tabs-nav-border: none;
      --gf-tabs-content-display: none;
      --gf-tabs-tab-min-width: 88px;
      --gf-tabs-tab-padding: 6px 12px;
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
