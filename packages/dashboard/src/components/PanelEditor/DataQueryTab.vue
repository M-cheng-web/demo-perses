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
                    type="text"
                    size="small"
                    :class="bem('icon-btn')"
                    :icon="h(draft.hide ? EyeInvisibleOutlined : EyeOutlined)"
                    @click="toggleQueryVisibility(index)"
                  />
                </Tooltip>

                <Tooltip :title="draft.collapsed ? '展开' : '折叠'">
                  <Button
                    type="text"
                    size="small"
                    :class="bem('icon-btn')"
                    :icon="h(draft.collapsed ? DownOutlined : UpOutlined)"
                    @click="togglePanelCollapsed(index)"
                  />
                </Tooltip>

                <Tooltip v-if="queryMode === 'builder' && draft.builder.status === 'ok'" title="模版填充">
                  <Button type="text" size="small" :class="bem('icon-btn')" :icon="h(ThunderboltOutlined)" @click="openQueryPatterns(index)" />
                </Tooltip>

                <Popconfirm v-if="queryDrafts.length > 1" title="确认删除该查询？" @confirm="removeQuery(index)">
                  <Tooltip title="删除查询">
                    <Button type="text" size="small" :class="bem('icon-btn', 'danger')" :icon="h(DeleteOutlined)" />
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          </div>

          <!-- 查询内容区 -->
          <Transition name="fade-collapse">
            <div v-show="!draft.collapsed" :class="bem('query-content')">
              <!-- QueryBuilder 模式 -->
              <div v-if="queryMode === 'builder'" :class="bem('builder-mode')">
                <Space direction="vertical" :size="10" style="width: 100%">
                  <Alert
                    v-if="draft.builder.status !== 'ok'"
                    type="warning"
                    show-icon
                    :message="`该 PromQL 无法完整转换为 Builder（${draft.refId}）`"
                    :description="draft.builder.message || '请在 Code 模式编辑该表达式；保存/执行仍将使用 Code 的 PromQL。'"
                  />

                  <template v-else>
                    <!-- 指标选择 -->
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
  import { h, onBeforeUnmount, ref, watch } from 'vue';
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
  import { parsePromqlToVisualQuery, promQueryModeller } from '@grafana-fast/utils';
  import { createNamespace, createPrefixedId, debounceCancellable, deepClone } from '/#/utils';
  import type { CanonicalQuery, DatasourceRef, PromVisualQuery } from '@grafana-fast/types';
  import type { PromqlParseWarning } from '@grafana-fast/utils';

  const [_, bem] = createNamespace('data-query-tab');

  interface Props {
    queries?: CanonicalQuery[];
    datasource?: any;
    /**
     * Optional session key to force re-initialization.
     * - When the panel editor switches to another panel, parent should change this value.
     * - Helps avoid "props update loops" while still supporting external resets.
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

  type BuilderStatus = 'ok' | 'unsupported';

  interface QueryDraft {
    id: string;
    refId: string;
    hide: boolean;
    collapsed: boolean;
    code: {
      expr: string;
      legendFormat: string;
      minStep: number;
    };
    builder: {
      status: BuilderStatus;
      message?: string;
      parseWarnings?: PromqlParseWarning[];
      visualQuery: PromVisualQuery;
    };
  }

  const queryMode = ref<'builder' | 'code'>('builder');
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

  const queryDrafts = ref<QueryDraft[]>([]);
  const lastEmittedSignature = ref<string>('');

  // 将 PromQL 反解析 warnings（结构化）格式化成可读的中文提示文本（用于 Builder 底部 Alert 展示）
  function formatParseWarnings(warnings?: PromqlParseWarning[]): string {
    if (!warnings || warnings.length === 0) return '';
    return warnings
      .map((w) => {
        const where = w.path && w.path.length > 0 ? `位置：${w.path.join(' → ')}` : '位置：root';
        const snippet = w.snippet ? `片段：${w.snippet}` : '';
        return [w.message, where, snippet].filter(Boolean).join(' | ');
      })
      .join('；');
  }

  function signatureFromCanonical(queries: CanonicalQuery[] | undefined): string {
    const list = Array.isArray(queries) ? queries : [];
    try {
      return JSON.stringify(
        list.map((q) => ({
          id: q.id,
          refId: q.refId,
          expr: q.expr,
          legendFormat: q.legendFormat,
          minStep: q.minStep,
          hide: q.hide,
          format: q.format,
          instant: q.instant,
          datasourceRef: q.datasourceRef,
          visualQuery: (q as any).visualQuery ?? null,
        }))
      );
    } catch {
      // 兜底：如果无法 stringify，则强制认为“发生变化”，从而触发 reset
      return `__unstringifiable__:${Date.now()}`;
    }
  }

  function emptyVisualQuery(): PromVisualQuery {
    return { metric: '', labels: [], operations: [] };
  }

  function indexToRefId(index: number): string {
    let n = index;
    let out = '';
    while (n >= 0) {
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26) - 1;
    }
    return out;
  }

  function nextRefId(used: Set<string>): string {
    for (let i = 0; i < 10_000; i++) {
      const id = indexToRefId(i);
      if (!used.has(id)) return id;
    }
    return `${indexToRefId(0)}_${Math.random().toString(16).slice(2, 6)}`;
  }

  function getDatasourceRef(): DatasourceRef {
    const uid = props.datasource?.id ? String(props.datasource.id) : 'prometheus-mock';
    return { type: 'prometheus', uid };
  }

  function renderPromql(query: PromVisualQuery): string {
    try {
      return promQueryModeller.renderQuery(query);
    } catch (error) {
      console.error('Failed to render PromQL:', error);
      return '';
    }
  }

  function getPromQLForDraft(draft: QueryDraft): string {
    if (draft.builder.status === 'ok') return renderPromql(draft.builder.visualQuery);
    return draft.code.expr || '';
  }

  function buildDraftFromCanonical(q: CanonicalQuery, fallbackRefId: string): QueryDraft {
    const refId = (q.refId || fallbackRefId).trim() || fallbackRefId;
    const id = q.id || createPrefixedId('q');

    const persisted = (q as any).visualQuery as PromVisualQuery | undefined;
    if (persisted && typeof persisted === 'object') {
      return {
        id,
        refId,
        hide: !!q.hide,
        collapsed: false,
        code: {
          expr: String(q.expr ?? ''),
          legendFormat: String(q.legendFormat ?? ''),
          minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
        },
        builder: { status: 'ok', visualQuery: deepClone(persisted), parseWarnings: [] },
      };
    }

    const parsed = parsePromqlToVisualQuery(String(q.expr ?? ''));
    if (parsed.ok && (parsed.confidence === 'exact' || parsed.confidence === 'partial')) {
      return {
        id,
        refId,
        hide: !!q.hide,
        collapsed: false,
        code: {
          expr: String(q.expr ?? ''),
          legendFormat: String(q.legendFormat ?? ''),
          minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
        },
        builder: { status: 'ok', visualQuery: deepClone(parsed.value), parseWarnings: parsed.warnings ? [...parsed.warnings] : [] },
      };
    }

    if (parsed.ok && parsed.confidence === 'selector-only') {
      return {
        id,
        refId,
        hide: !!q.hide,
        collapsed: false,
        code: {
          expr: String(q.expr ?? ''),
          legendFormat: String(q.legendFormat ?? ''),
          minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
        },
        builder: {
          status: 'unsupported',
          message: parsed.warnings?.[0]?.message ?? '该表达式过于复杂，Builder 仅能提取部分信息；请使用 Code 模式编辑。',
          parseWarnings: parsed.warnings ? [...parsed.warnings] : [],
          visualQuery: deepClone(parsed.value),
        },
      };
    }

    return {
      id,
      refId,
      hide: !!q.hide,
      collapsed: false,
      code: {
        expr: String(q.expr ?? ''),
        legendFormat: String(q.legendFormat ?? ''),
        minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
      },
      builder: {
        status: 'unsupported',
        message: '该 PromQL 暂无法转换为 Builder（best-effort 解析失败），请使用 Code 模式编辑。',
        parseWarnings: [],
        visualQuery: emptyVisualQuery(),
      },
    };
  }

  function normalizeDrafts(drafts: QueryDraft[]): QueryDraft[] {
    const used = new Set<string>();
    const out: QueryDraft[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]!;
      let refId = String(d.refId ?? '').trim();
      if (!refId || used.has(refId)) refId = nextRefId(used);
      used.add(refId);
      out.push({ ...d, refId });
    }
    return out;
  }

  function resetFromProps(nextQueries?: CanonicalQuery[]) {
    const input = Array.isArray(nextQueries) ? nextQueries : Array.isArray(props.queries) ? props.queries : [];
    if (!input.length) {
      queryDrafts.value = [
        {
          id: createPrefixedId('q'),
          refId: 'A',
          hide: false,
          collapsed: false,
          code: { expr: '', legendFormat: '', minStep: 15 },
          builder: { status: 'ok', visualQuery: emptyVisualQuery(), parseWarnings: [] },
        },
      ];
      return;
    }

    queryDrafts.value = normalizeDrafts(input.map((q, i) => buildDraftFromCanonical(q, indexToRefId(i))));
  }

  watch(
    () => props.queries,
    (next) => {
      const sig = signatureFromCanonical(next);
      // 忽略由我们自身 emit('update:queries', ...) 引起的 props 回写更新
      if (sig === lastEmittedSignature.value) return;
      resetFromProps(next as any);
    },
    { deep: true, immediate: true }
  );

  watch(
    () => props.sessionKey,
    () => {
      // sessionKey 变化时强制重置（例如切换面板）
      lastEmittedSignature.value = '';
      resetFromProps(props.queries);
    }
  );

  const emitQueriesDebounced = debounceCancellable(() => {
    const next = convertDraftsToCanonical('save');
    lastEmittedSignature.value = signatureFromCanonical(next);
    emit('update:queries', next);
  }, 200);

  watch(
    queryDrafts,
    () => {
      emitQueriesDebounced();
    },
    { deep: true }
  );

  watch(
    () => queryMode.value,
    (mode) => {
      // 切换模式只做模型同步，不应触发执行查询
      if (mode === 'code') syncAllBuilderToCode();
      if (mode === 'builder') syncAllCodeToBuilder();
    }
  );

  const togglePanelCollapsed = (index: number) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    d.collapsed = !d.collapsed;
  };

  const toggleQueryVisibility = (index: number) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    d.hide = !d.hide;
  };

  const handleCodeExprInput = (index: number) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    d.builder.status = 'unsupported';
    d.builder.message = '已在 Code 模式编辑 PromQL，Builder 需要重新解析（切换到 Builder 会自动尝试）。';
    d.builder.parseWarnings = [];
    d.builder.visualQuery = emptyVisualQuery();
  };

  const handleCodeExprChange = (_index: number) => {
    // 预留：后续可在这里接入校验/格式化逻辑
  };

  const addQuery = () => {
    const used = new Set(queryDrafts.value.map((d) => d.refId));
    const refId = nextRefId(used);
    queryDrafts.value.push({
      id: createPrefixedId('q'),
      refId,
      hide: false,
      collapsed: false,
      code: { expr: '', legendFormat: '', minStep: 15 },
      builder: { status: 'ok', visualQuery: emptyVisualQuery(), parseWarnings: [] },
    });
  };

  const removeQuery = (index: number) => {
    queryDrafts.value.splice(index, 1);
  };

  const openQueryPatterns = (index: number) => {
    currentPatternQueryIndex.value = index;
    patternsModalOpen.value = true;
  };

  const handlePatternSelect = (query: PromVisualQuery) => {
    const draft = queryDrafts.value[currentPatternQueryIndex.value];
    if (draft) {
      draft.builder.status = 'ok';
      draft.builder.message = undefined;
      draft.builder.parseWarnings = [];
      draft.builder.visualQuery = deepClone({
        metric: query.metric ?? '',
        labels: deepClone(query.labels ?? []),
        operations: deepClone(query.operations ?? []),
        binaryQueries: deepClone(query.binaryQueries ?? []),
      });
      // 同步 code.expr（便于 JSON/导出），但不触发执行查询
      draft.code.expr = renderPromql(draft.builder.visualQuery);
    }
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
    const draft = queryDrafts.value[index];
    if (!draft) return;
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.visualQuery = deepClone(updatedQuery);
  };

  const handleBuilderQueryUpdate = (index: number, updatedQuery: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.visualQuery = deepClone(updatedQuery);
    // 同步 code.expr（不触发执行）
    draft.code.expr = renderPromql(draft.builder.visualQuery);
  };

  const syncAllBuilderToCode = () => {
    for (const d of queryDrafts.value) {
      if (d.builder.status !== 'ok') continue;
      d.code.expr = renderPromql(d.builder.visualQuery);
    }
  };

  const syncAllCodeToBuilder = () => {
    for (const d of queryDrafts.value) {
      if (d.builder.status === 'ok') continue;
      const parsed = parsePromqlToVisualQuery(d.code.expr);
      if (parsed.ok && (parsed.confidence === 'exact' || parsed.confidence === 'partial')) {
        d.builder.status = 'ok';
        d.builder.message = undefined;
        d.builder.visualQuery = deepClone(parsed.value);
        d.builder.parseWarnings = parsed.warnings ? [...parsed.warnings] : [];
        continue;
      }
      if (parsed.ok && parsed.confidence === 'selector-only') {
        d.builder.status = 'unsupported';
        d.builder.message = parsed.warnings?.[0]?.message ?? '该表达式过于复杂，Builder 仅能提取部分信息；请使用 Code 模式编辑。';
        d.builder.visualQuery = deepClone(parsed.value);
        d.builder.parseWarnings = parsed.warnings ? [...parsed.warnings] : [];
        continue;
      }
      d.builder.status = 'unsupported';
      d.builder.message = '该 PromQL 暂无法转换为 Builder（best-effort 解析失败），请使用 Code 模式编辑。';
      d.builder.parseWarnings = [];
      d.builder.visualQuery = emptyVisualQuery();
    }
  };

  const validateDrafts = (purpose: 'save' | 'execute') => {
    const errors: Array<{ refId: string; message: string }> = [];
    for (const d of queryDrafts.value) {
      const shouldValidate = purpose === 'save' ? true : !d.hide;
      if (!shouldValidate) continue;
      const expr = queryMode.value === 'builder' && d.builder.status === 'ok' ? renderPromql(d.builder.visualQuery) : d.code.expr;
      if (!expr || !String(expr).trim()) {
        errors.push({ refId: d.refId || 'query', message: '表达式不能为空' });
      }
    }
    return { ok: errors.length === 0, errors };
  };

  const convertDraftsToCanonical = (purpose: 'save' | 'execute'): CanonicalQuery[] => {
    const datasourceRef = getDatasourceRef();
    return queryDrafts.value.map((d) => {
      const expr = queryMode.value === 'builder' && d.builder.status === 'ok' ? renderPromql(d.builder.visualQuery) : d.code.expr;
      const out: CanonicalQuery = {
        id: d.id,
        refId: d.refId,
        datasourceRef,
        expr: expr || '',
        legendFormat: d.code.legendFormat || '',
        minStep: d.code.minStep || 15,
        format: 'time_series',
        instant: false,
        hide: d.hide,
      };

      if (d.builder.status === 'ok') {
        (out as any).visualQuery = deepClone(d.builder.visualQuery);
      } else if (purpose === 'save') {
        const parsed = parsePromqlToVisualQuery(expr || '');
        if (parsed.ok && parsed.confidence === 'exact') {
          (out as any).visualQuery = deepClone(parsed.value);
        }
      }
      return out;
    });
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
    lastEmittedSignature.value = signatureFromCanonical(next);
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
    --dp-primary-soft-1: var(--gf-color-primary-soft);
    --dp-primary-soft-2: var(--gf-color-primary-soft-hover);
    --dp-primary-soft-3: var(--gf-color-primary-soft-active);
    --dp-border-soft: var(--gf-color-border-muted);

    display: flex;
    flex-direction: column;
    gap: 10px;
    color: var(--gf-color-text);

    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
      box-shadow: none;
      gap: 12px;
      flex-wrap: wrap;
    }

    &__header-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      min-width: 0;
    }

    &__title-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 220px;
    }

    &__title {
      font-weight: 700;
      font-size: 16px;
      color: var(--gf-color-text);
      letter-spacing: 0.3px;
      line-height: 1.3;
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
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-sm);
      background: var(--gf-color-surface-muted);
      box-shadow: none;
    }

    &__chip-label {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
      letter-spacing: 0.2px;
    }

    &__header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    &__run-btn {
      border-radius: var(--gf-radius-sm);
      padding: 6px 14px;
      font-weight: 700;
      height: 32px;
    }

    &__queries {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    &__add-btn {
      margin-top: 4px;
      height: 32px;
      font-weight: 600;
      border-radius: var(--gf-radius-sm);

      &:hover {
        box-shadow: none;
      }
    }

    &__query-item {
      width: 100%;
    }

    &__query-wrapper {
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      overflow: hidden;
      background: var(--gf-color-surface);
      box-shadow: none;
      transition:
        box-shadow 0.2s ease,
        border-color 0.2s ease;

      &:hover {
        box-shadow: none;
        border-color: var(--gf-color-border-strong);
      }

      &--collapsed {
        border-color: var(--gf-color-border-muted);

        .dp-data-query-tab__query-content {
          border-top: 1px dashed var(--gf-color-border-muted);
        }
      }
    }

    &__query-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--gf-color-surface-muted);
      border-bottom: 1px solid var(--gf-color-border-muted);
      gap: 12px;
      flex-wrap: wrap;
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
      font-weight: 700;
      font-size: 13px;
      color: var(--gf-color-text);
    }

    &__query-subtitle {
      font-size: 12px;
      color: var(--gf-color-text-tertiary);
    }

    &__query-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: var(--gf-radius-xs);
      background: var(--dp-primary-soft-2);
      color: var(--gf-color-primary);
      font-weight: 700;
      font-size: 12px;
      border: 1px solid var(--gf-color-primary-border);
      flex-shrink: 0;
    }

    &__query-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    &__action-buttons {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    :deep(.dp-data-query-tab__icon-btn) {
      --gf-btn-color: var(--gf-color-text-tertiary);
      --gf-btn-bg-hover: var(--gf-color-fill-secondary);
      --gf-btn-bg-active: var(--gf-color-fill-tertiary);
      --gf-btn-shadow-hover: none;
    }

    :deep(.dp-data-query-tab__icon-btn:hover) {
      --gf-btn-color: var(--gf-color-primary);
    }

    :deep(.dp-data-query-tab__icon-btn--danger) {
      --gf-btn-color: var(--gf-color-danger);
      --gf-btn-bg-hover: var(--gf-color-danger-soft);
      --gf-btn-bg-active: var(--gf-color-danger-soft);
    }

    &__query-content {
      padding: 12px;
      background: var(--gf-color-surface);
    }

    &__builder-mode,
    &__code-mode {
      width: 100%;
    }

    &__section {
      width: 100%;
      border: none;
      border-left: 2px solid var(--gf-color-border-muted);
      border-radius: var(--gf-radius-xs);
      overflow: hidden;
      background: var(--gf-color-surface);
      box-shadow: none;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;

      // 不同区块的左边框强调色
      &--metric {
        border-left-color: var(--gf-color-primary);
      }

      &--filters {
        border-left-color: var(--gf-color-success);
      }

      &--operations {
        border-left-color: var(--gf-color-warning);
      }

      &--binary {
        border-left-color: var(--gf-color-primary-border-strong);
      }

      &:hover {
        border-left-color: var(--gf-color-border-strong);
        box-shadow: none;
      }
    }

    &__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-muted);
    }

    &__section-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--gf-color-text);
      line-height: 1.5;
      letter-spacing: 0.1px;
    }

    &__section-content {
      padding: 12px;
    }

    &__code-mode {
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      padding: 12px;
    }

    &__mode-tabs {
      min-width: 180px;

      :deep(.gf-tabs__content) {
        display: none;
      }

      :deep(.dp-data-query-tab__mode-tabs.gf-tabs) {
        border: 1px solid var(--gf-color-border-muted);
        border-radius: var(--gf-radius-sm);
        background: var(--gf-color-surface);
      }

      :deep(.gf-tabs__nav) {
        padding: 2px;
        border-bottom: none;
      }

      :deep(.gf-tabs__tab) {
        min-width: 86px;
        padding: 5px 10px;
        border-radius: var(--gf-radius-xs);
      }

      :deep(.gf-tabs__tab.is-active) {
        background: var(--gf-color-primary-soft);
        box-shadow: inset 0 -2px 0 var(--gf-color-primary);
      }
    }

    &__code-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px 16px;
    }

    &__code-item--wide {
      grid-column: 1 / -1;
    }

    // 子组件样式
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

  .fade-collapse-enter-active,
  .fade-collapse-leave-active {
    transition: all 0.2s ease;
  }

  .fade-collapse-enter-from,
  .fade-collapse-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }
</style>
