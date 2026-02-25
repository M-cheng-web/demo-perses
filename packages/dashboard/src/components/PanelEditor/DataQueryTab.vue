<!-- 数据查询标签页 - 支持 QueryBuilder 和手动 PromQL 两种模式 -->
<template>
  <div :class="bem()">
    <!-- 顶部操作栏 -->
    <div :class="bem('header')">
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
              <!-- 模式切换 / 解释开关（每个查询独立） -->
              <div :class="bem('query-tools')">
                <div :class="bem('controls')">
                  <div :class="[bem('control-chip'), bem('control-chip--mode')]">
                    <span :class="bem('chip-label')">模式</span>
                    <Segmented
                      :class="bem('mode-segmented')"
                      :value="draft.mode"
                      :options="queryModeOptions"
                      @update:value="(value: unknown) => handleQueryModeChange(index, value)"
                    />
                  </div>

                  <div v-if="draft.mode === 'builder'" :class="[bem('control-chip'), bem('control-chip--explain')]">
                    <span :class="bem('chip-label')">解释</span>
                    <Switch v-model:checked="draft.showExplain" />
                  </div>
                </div>
              </div>

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
                  <template v-if="draft.mode === 'code'">点击将追加到 PromQL 并复制</template>
                  <template v-else>点击复制，可粘贴到标签值/操作参数中</template>
                </div>
              </div>

              <!-- QueryBuilder 模式 -->
              <div v-if="draft.mode === 'builder'" :class="bem('builder-mode')">
                <Space direction="vertical" :size="10" style="width: 100%">
                  <Alert
                    v-if="draft.builder.status !== 'ok'"
                    :type="draft.builder.issueType === 'syntax' ? 'error' : 'warning'"
                    show-icon
                    :message="
                      draft.builder.issueType === 'syntax'
                        ? `PromQL 语法错误（${draft.refId}）`
                        : `该查询无法在 QueryBuilder 中编辑（${draft.refId}）`
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
                    <!-- 指标选择 -->
                    <div :class="bem('builder-sections')">
                      <div :class="[bem('section'), bem('section--metric')]">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">指标</span>
	                        </div>
	                        <div :class="bem('section-content')">
	                          <MetricSelector :class="bem('metric-selector')" v-model="draft.builder.visualQuery.metric" />
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
	                            :show-explain="draft.showExplain"
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
                      <div v-if="draft.showExplain && draft.builder.visualQuery.metric" :class="bem('section')">
                        <div :class="bem('section-header')">
                          <span :class="bem('section-title')">查询解释</span>
                        </div>
                        <div :class="bem('section-content')">
                          <QueryExplain :class="bem('query-explain')" :query="draft.builder.visualQuery" @highlight="handleHighlightOperation" />
                        </div>
                      </div>

                    </div>
                  </template>
                </Space>
              </div>

              <!-- PromQL 代码模式 -->
              <div v-else :class="bem('code-mode')">
                <Alert
                  v-if="draft.builder.status !== 'ok' && draft.builder.message"
                  :type="draft.builder.issueType === 'syntax' ? 'error' : 'warning'"
                  show-icon
                  :message="draft.builder.issueType === 'syntax' ? 'PromQL 语法错误，已使用 Code 模式' : '无法切换到 QueryBuilder，已保持 Code 模式'"
                  :description="
                    [draft.builder.message, formatParseWarnings(draft.builder.parseWarnings), formatDiagnostics(draft.builder.diagnostics)]
                      .filter(Boolean)
                      .join('；')
                  "
                  style="margin-bottom: 8px"
                />
                <div :class="bem('code-grid')">
                  <FormItem :class="bem('code-item', 'wide')" label="PromQL 表达式">
                    <Textarea
                      v-model:value="draft.code.expr"
                      placeholder="例如：cpu_usage"
                      :rows="3"
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

  </div>
</template>

<script setup lang="ts">
  import { computed, h, onBeforeUnmount, ref, watch } from 'vue';
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
  } from '@ant-design/icons-vue';
  import MetricSelector from '/#/components/QueryBuilder/MetricSelector.vue';
  import LabelFilters from '/#/components/QueryBuilder/LabelFilters.vue';
  import OperationsList from '/#/components/QueryBuilder/query-builder/OperationsList.vue';
  import NestedQueryList from '/#/components/QueryBuilder/query-builder/NestedQueryList.vue';
  import QueryHints from '/#/components/QueryBuilder/query-builder/QueryHints.vue';
  import QueryPreview from '/#/components/QueryBuilder/QueryPreview.vue';
  import QueryExplain from '/#/components/QueryBuilder/query-builder/QueryExplain.vue';
  import { extractVariableNameFromToken, getLabelFilterVariableOptions } from '/#/components/QueryBuilder/labelFilterVariables';
  import { useApiClient } from '/#/runtime/useInjected';
  import { createNamespace, debounceCancellable } from '/#/utils';
  import type { CanonicalQuery, PromVisualQuery } from '@grafana-fast/types';
  import { parsePromqlToVisualQuery, promQueryModeller } from '@grafana-fast/utils';
  import { useVariablesStore } from '/#/stores';

  import {
    appendTokenToExpr,
    formatDiagnostics,
    formatParseWarnings,
    getPromQLForDraft,
    normalizeVariableToken,
    renderPromql,
  } from './dataQueryTab/helpers';
  import type { QueryMode } from './dataQueryTab/types';
  import { useDataQueryTabDraftLifecycle } from './dataQueryTab/useDataQueryTabDraftLifecycle';

  const [_, bem] = createNamespace('data-query-tab');

  const api = useApiClient();
  const variablesStore = useVariablesStore();
  const availableVariables = computed(() => variablesStore.variables ?? []);

  interface Props {
    queries?: CanonicalQuery[];
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

  const queryModeOptions = [
    { label: 'QueryBuilder', value: 'builder' },
    { label: 'Code', value: 'code' },
  ] as const;
  const highlightedOpIndex = ref<number>();

  const clearHighlightedOp = debounceCancellable(() => {
    highlightedOpIndex.value = undefined;
  }, 2000);

  // 防止“异步校验”导致模式切换竞态：用 id 代替 index 做代际控制
  const modeSwitchGeneration = new Map<string, number>();

  onBeforeUnmount(() => {
    clearHighlightedOp.cancel();
  });

  const {
    queryDrafts,
    togglePanelCollapsed,
    toggleQueryVisibility,
    addQuery,
    removeQuery,
    updateNestedQuery,
    updateBuilderQuery,
    switchQueryMode,
    validateDrafts,
    convertDraftsToCanonical,
    markEmitted,
  } = useDataQueryTabDraftLifecycle({
    getQueriesProp: () => props.queries,
    getSessionKey: () => props.sessionKey,
    emitUpdateQueries: (queries) => emit('update:queries', queries),
  });

  const handleCodeExprChange = (_index: number) => {
    // 预留：后续可在这里接入校验/格式化逻辑
  };

  // 保证 Builder/Code 使用同一份 expr：
  // - Builder 模式下：任何 visualQuery 变更都会同步到 code.expr（canonical form）
  // - Code 模式下：不自动改写用户输入；切回 Builder 时再做解析检查
  watch(
    queryDrafts,
    (list) => {
      for (const d of list) {
        if (d.mode !== 'builder') continue;
        if (d.builder.status !== 'ok') continue;
        const nextExpr = renderPromql(d.builder.visualQuery);
        if (nextExpr && nextExpr !== d.code.expr) d.code.expr = nextExpr;
        if (!nextExpr && d.code.expr) d.code.expr = '';
      }
    },
    { deep: true }
  );

  const handleQueryModeChange = (index: number, value: unknown) => {
    const next: QueryMode = value === 'code' ? 'code' : 'builder';
    const draft = queryDrafts.value[index];
    if (!draft) return;

    const draftId = String(draft.id ?? `${index}`);
    const gen = (modeSwitchGeneration.get(draftId) ?? 0) + 1;
    modeSwitchGeneration.set(draftId, gen);

    const showSwitchError = (msg: string) => {
      message.error({ content: msg || '无法切换模式', key: `query-mode:${draftId}`, duration: 3200 });
    };

    const setBuilderBlocked = (target: typeof draft, blockedMsg: string, parsed?: { ok: true; value: PromVisualQuery; warnings?: any[]; confidence?: any }) => {
      // 关键：保持在 code 模式
      target.mode = 'code';
      target.builder.status = 'unsupported';
      target.builder.issueType = 'unsupported';
      target.builder.message = blockedMsg;
      if (parsed?.ok) {
        target.builder.parseWarnings = Array.isArray(parsed.warnings) ? [...parsed.warnings] : [];
        target.builder.confidence = parsed.confidence ?? target.builder.confidence;
        target.builder.visualQuery = parsed.value;
      }
    };

    // builder -> code：同步 expr 即可（纯同步）
    if (next === 'code') {
      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const res = switchQueryMode(idx, 'code');
      if (!res.ok) showSwitchError(res.message || '无法切换到 Code 模式');
      return;
    }

    // code -> builder：额外校验“可反显的选项值”是否存在，否则不允许切换
    if (draft.mode !== 'code') {
      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const res = switchQueryMode(idx, 'builder');
      if (!res.ok) showSwitchError(res.message || '无法切换到 QueryBuilder');
      return;
    }

    const expr = String(draft.code.expr ?? '').trim();
    if (!expr) {
      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const res = switchQueryMode(idx, 'builder');
      if (!res.ok) showSwitchError(res.message || '无法切换到 QueryBuilder');
      return;
    }

    const parsed = parsePromqlToVisualQuery(expr);
    if (!parsed.ok) {
      // 走既有逻辑：会自动保持 code 模式，并产出统一提示文案
      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const res = switchQueryMode(idx, 'builder');
      if (!res.ok) showSwitchError(res.message || '无法切换到 QueryBuilder');
      return;
    }

    if (parsed.confidence !== 'exact') {
      // 走既有逻辑：会自动保持 code 模式，并产出统一提示文案
      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const res = switchQueryMode(idx, 'builder');
      if (!res.ok) showSwitchError(res.message || '无法切换到 QueryBuilder');
      return;
    }

    const buildIssueMessage = (issues: string[]) => {
      const head = issues.slice(0, 3).join('；');
      const more = issues.length > 3 ? `（另有 ${issues.length - 3} 处）` : '';
      return `无法切换到 QueryBuilder：${head}${more}。请继续使用 Code 模式。`;
    };

    const validateQueryOptions = async (q: PromVisualQuery, prefix: string, issues: string[], caches: any) => {
      const metric = String(q.metric ?? '').trim();
      if (!metric) {
        if ((q.labels?.length ?? 0) > 0 || (q.operations?.length ?? 0) > 0) {
          issues.push(`${prefix}缺少指标名，无法校验 QueryBuilder 选项`);
        }
      }

      const getMetricExists = async (): Promise<boolean | null> => {
        if (!metric) return null;
        const cached = caches.metricExists.get(metric);
        if (cached) return cached;
        const p = api.query
          .fetchMetrics(metric)
          .then((list) => Array.isArray(list) && list.includes(metric))
          .catch((error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            issues.push(`${prefix}校验指标 '${metric}' 失败（POST /query/metrics）：${msg}`);
            return null;
          });
        caches.metricExists.set(metric, p);
        return p;
      };

      const getLabelKeys = async (): Promise<Set<string> | null> => {
        if (!metric) return null;
        const cached = caches.labelKeys.get(metric);
        if (cached) return cached;
        const p = api.query
          .fetchLabelKeys(metric)
          .then((list) => new Set((Array.isArray(list) ? list : []).map((v) => String(v))))
          .catch((error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            issues.push(`${prefix}加载标签名列表失败（POST /query/label-keys）：${msg}`);
            return null;
          });
        caches.labelKeys.set(metric, p);
        return p;
      };

      const stableOtherLabelsKey = (otherLabels: Record<string, string>) => {
        const keys = Object.keys(otherLabels).sort();
        const normalized: Record<string, string> = {};
        for (const k of keys) normalized[k] = otherLabels[k]!;
        return JSON.stringify(normalized);
      };

      const getLabelValues = async (labelKey: string, otherLabels: Record<string, string>): Promise<Set<string> | null> => {
        if (!metric) return null;
        const key = `${metric}@@${labelKey}@@${stableOtherLabelsKey(otherLabels)}`;
        const cached = caches.labelValues.get(key);
        if (cached) return cached;
        const p = api.query
          .fetchLabelValues(metric, labelKey, otherLabels)
          .then((list) => new Set((Array.isArray(list) ? list : []).map((v) => String(v))))
          .catch((error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            issues.push(`${prefix}加载标签值列表失败（POST /query/label-values, ${labelKey}）：${msg}`);
            return null;
          });
        caches.labelValues.set(key, p);
        return p;
      };

      // (1) 指标：必须存在于可选列表中（POST /query/metrics）
      const metricOk = await getMetricExists();
      if (metricOk === false) {
        issues.push(`${prefix}指标 '${metric}' 不在后端返回的指标列表中（POST /query/metrics）`);
      }

      // (2) 标签名：必须存在于可选列表中（POST /query/label-keys）
      const labelKeys = await getLabelKeys();
      const hasLabelKey = (k: string) => (labelKeys ? labelKeys.has(k) : true);

      for (const f of q.labels ?? []) {
        const k = String(f?.label ?? '').trim();
        if (!k) continue;
        if (k === '__name__') continue;
        if (!hasLabelKey(k)) issues.push(`${prefix}标签名 '${k}' 不在可选列表中（POST /query/label-keys）`);
      }

      // (3) 操作参数中的 label：LabelParamEditor 依赖 label-keys 下拉
      for (const op of q.operations ?? []) {
        const opId = String(op?.id ?? '').trim();
        if (!opId) continue;
        const def = promQueryModeller.getOperationDef(opId);
        if (!def) continue;
        const params = Array.isArray(op?.params) ? op.params : [];
        for (let i = 0; i < params.length; i++) {
          const paramDef = def.params?.[Math.min((def.params?.length ?? 1) - 1, i)];
          if (!paramDef) continue;
          if (paramDef.editor !== 'LabelParamEditor') continue;
          const v = String(params[i] ?? '').trim();
          if (!v) continue;
          if (!hasLabelKey(v)) issues.push(`${prefix}操作 ${opId} 的标签参数 '${v}' 不在可选列表中（POST /query/label-keys）`);
        }
      }

      // (4) 标签值：仅对 = / != 做“必须在下拉列表里”的校验（POST /query/label-values）
      // - 正则（=~ / !~）本身不是“选项值”，允许继续编辑
      const looksLikeVariableRef = (value: string) => /\$\{|\[\[|\$[A-Za-z_]/.test(value);
      const variableValueTokens = new Set(getLabelFilterVariableOptions(variablesStore.variables ?? []).map((o) => o.value));

      for (let i = 0; i < (q.labels?.length ?? 0); i++) {
        const f = q.labels?.[i];
        if (!f) continue;
        const k = String(f.label ?? '').trim();
        if (!k) continue;
        const op = String(f.op ?? '').trim();
        if (op !== '=' && op !== '!=') continue;

        const rawValue = String(f.value ?? '');
        // 空字符串是合法 PromQL（label=""），不阻断切换
        if (rawValue === '') continue;

        const varName = extractVariableNameFromToken(rawValue);
        if (varName) {
          const token = `$${varName}`;
          if (!variableValueTokens.has(token)) {
            issues.push(`${prefix}变量 ${token} 未在后端下发，无法用于标签过滤（POST /variables/load）`);
          }
          continue;
        }

        const otherLabels: Record<string, string> = {};
        for (let j = 0; j < (q.labels?.length ?? 0); j++) {
          if (j === i) continue;
          const o = q.labels?.[j];
          if (!o?.label || o.value == null) continue;
          const ov = String(o.value);
          if (!ov) continue;
          if (looksLikeVariableRef(ov)) continue;
          otherLabels[String(o.label)] = ov;
        }

        const values = await getLabelValues(k, otherLabels);
        if (!values) continue;
        const allowed = new Set<string>([...values, ...variableValueTokens]);
        if (!allowed.has(rawValue)) {
          issues.push(`${prefix}标签 ${k} 的值 '${rawValue}' 不在可选列表中（POST /query/label-values）`);
        }
      }

      // (5) 递归校验二元查询
      const nested = q.binaryQueries ?? [];
      for (let i = 0; i < nested.length; i++) {
        const bq = nested[i];
        if (!bq?.query) continue;
        await validateQueryOptions(bq.query as PromVisualQuery, `${prefix}二元查询#${i + 1}：`, issues, caches);
      }
    };

    const checkSwitchable = async (): Promise<{ ok: true } | { ok: false; issues: string[] }> => {
      const issues: string[] = [];
      const caches = {
        metricExists: new Map<string, Promise<boolean | null>>(),
        labelKeys: new Map<string, Promise<Set<string> | null>>(),
        labelValues: new Map<string, Promise<Set<string> | null>>(),
      };
      await validateQueryOptions(parsed.value, '', issues, caches);
      return issues.length ? { ok: false, issues } : { ok: true };
    };

    void (async () => {
      const check = await checkSwitchable();
      // 如果期间发生了新的模式切换请求，则放弃本次结果
      if ((modeSwitchGeneration.get(draftId) ?? 0) !== gen) return;

      const idx = queryDrafts.value.findIndex((d) => String(d.id) === draftId);
      if (idx < 0) return;
      const current = queryDrafts.value[idx];
      if (!current) return;

      if (!check.ok) {
        const msg = buildIssueMessage(check.issues);
        setBuilderBlocked(current, msg, parsed);
        showSwitchError(msg);
        return;
      }

      const res = switchQueryMode(idx, 'builder');
      if (!res.ok) {
        showSwitchError(res.message || '无法切换到 QueryBuilder');
      } else {
        // 清掉之前的“解析失败”提示（若有），避免用户误解
        current.builder.status = 'ok';
        current.builder.issueType = undefined;
        current.builder.message = undefined;
      }
    })();
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

    // Code 模式：直接插入到 expr（末尾）；Builder 保持独立不联动
    if (d.mode === 'code') {
      d.code.expr = appendTokenToExpr(d.code.expr ?? '', token);
    }

    const ok = await copyToClipboard(token);
    if (ok) {
      message.success(`已复制：${token}`);
    } else {
      // clipboard 失败时，至少给用户可见提示（用户仍可手动输入 $var）
      message.info(`变量：${token}`);
    }
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
    padding: 0;

    // ===== 顶部操作栏 =====
    &__header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
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

    &__query-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
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
