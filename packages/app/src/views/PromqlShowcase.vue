<!--
  页面说明：演示站点 - PromQL 测试页

  目标：
  - 为 @grafana-fast/promql 提供一个“可视化回归与排查”的入口
  - 覆盖常见与边缘场景：语法错误、Grafana 变量、range/subquery、聚合/函数、binary/vector matching、offset/@ 等

  说明：
  - 这是工具页，不是最终产品页
  - 这里尽量保持“一个模式”：直接使用 promql 包内置的默认策略（无额外选项）
-->
<template>
  <ConfigProvider theme="inherit">
    <div class="dp-promql-showcase">
      <div class="dp-promql-showcase__header">
        <div class="dp-promql-showcase__title">
          <div class="dp-promql-showcase__h1">@grafana-fast/promql 测试页</div>
          <div class="dp-promql-showcase__sub">用于验证 PromQL 语法诊断（AST + diagnostics）与 Code → Builder 转换（best-effort）。</div>
        </div>

        <Flex justify="end" :gap="10" wrap>
          <Segmented v-model:value="themeModel" size="small" :options="themeOptions" />
          <Button size="small" type="ghost" @click="goComponents">组件展示</Button>
          <Button size="small" type="ghost" @click="goJsonEditor">JSON Editor 测试</Button>
          <Button size="small" type="ghost" @click="goHome">返回 Dashboard</Button>
        </Flex>
      </div>

      <div class="dp-promql-showcase__toolbar">
        <Space wrap :size="8">
          <Button size="small" type="primary" @click="runNow">解析 / 转换（Run）</Button>
          <Button size="small" @click="runBatch">批量回归（Run all examples）</Button>
        </Space>
        <Space wrap :size="8">
          <Tag :color="astOk ? 'var(--gf-color-success)' : 'var(--gf-color-danger)'">syntax: {{ astOk ? 'ok' : 'error' }}</Tag>
          <Tag v-if="builderOk" color="var(--gf-color-primary)">confidence: {{ builderConfidence }}</Tag>
          <Tag v-else color="var(--gf-color-warning)">builder: unsupported</Tag>
          <Tag color="var(--gf-color-text-secondary)">diagnostics: {{ diagnosticsCount }}</Tag>
          <Tag color="var(--gf-color-text-secondary)">warnings: {{ warningsCount }}</Tag>
        </Space>
      </div>

      <div class="dp-promql-showcase__grid">
        <Card title="输入（PromQL）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <div class="dp-promql-showcase__hint">
              提示：内部会对常见 Grafana 变量做“长度保持”的占位替换（例如 <span class="dp-promql-showcase__mono">$__interval</span>），用于语法解析与 range 对齐；不会改动保存/执行的原始 PromQL。
            </div>
            <Textarea v-model:value="expr" :rows="6" placeholder="输入 PromQL..." />
          </Space>
        </Card>

        <Card title="用例（常见 / 边缘）" size="small" :bordered="true">
          <Tabs v-model:activeKey="examplesTab" size="small">
            <TabPane name="common" tab="常见">
              <Space wrap :size="8">
                <Button v-for="e in examplesCommon" :key="e.key" size="small" @click="applyExample(e)">{{ e.title }}</Button>
              </Space>
            </TabPane>
            <TabPane name="functions" tab="函数/聚合">
              <Space wrap :size="8">
                <Button v-for="e in examplesFunctions" :key="e.key" size="small" @click="applyExample(e)">{{ e.title }}</Button>
              </Space>
            </TabPane>
            <TabPane name="binary" tab="二元/匹配">
              <Space wrap :size="8">
                <Button v-for="e in examplesBinary" :key="e.key" size="small" @click="applyExample(e)">{{ e.title }}</Button>
              </Space>
            </TabPane>
            <TabPane name="edge" tab="边缘/错误">
              <Space wrap :size="8">
                <Button v-for="e in examplesEdge" :key="e.key" size="small" @click="applyExample(e)">{{ e.title }}</Button>
              </Space>
            </TabPane>
          </Tabs>

          <Divider />

          <div v-if="activeExample" class="dp-promql-showcase__example-meta">
            <div class="dp-promql-showcase__hint"><span class="dp-promql-showcase__mono">key</span>：{{ activeExample.key }}</div>
            <div v-if="activeExample.notes" class="dp-promql-showcase__hint">说明：{{ activeExample.notes }}</div>
          </div>
        </Card>

        <Card title="转换结果（PromVisualQuery）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Alert
              v-if="builderOk && builderConfidence !== 'exact'"
              type="warning"
              show-icon
              message="该表达式无法完全等价反解析为 Builder"
              :description="warningsText || '存在未支持/已过滤的语义，请查看 warnings。'"
            />
            <Alert v-else-if="!builderOk && builderError" type="error" show-icon message="Builder 转换失败" :description="builderError" />

            <Textarea :rows="14" :value="visualQueryJson" readonly />
          </Space>
        </Card>

        <Card title="回写 PromQL（renderQuery）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <div class="dp-promql-showcase__hint">用于验证 Builder 结构是否能稳定渲染回 PromQL（不代表与原表达式完全等价）。</div>
            <Textarea :rows="6" :value="renderedPromql" readonly />
          </Space>
        </Card>

        <Card title="语法诊断（diagnostics）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Alert v-if="diagnosticsCount === 0" type="success" show-icon message="暂无语法诊断" />
            <List v-else :items="diagnosticItems" variant="lines" :split="false" />
          </Space>
        </Card>

        <Card title="AST（debugPrintTree）" size="small" :bordered="true">
          <Space direction="vertical" :size="10" style="width: 100%">
            <Space wrap :size="8">
              <Switch v-model:checked="astDebugEnabled" />
              <div class="dp-promql-showcase__hint">
                显示 AST（debug）。注意：AST 文本可能很长，默认关闭以避免页面卡顿；需要排查时再打开。
              </div>
            </Space>
            <Alert v-if="!astDebugEnabled" type="info" show-icon message="AST 输出已关闭" description="开启后会在每次解析时生成 debugPrintTree 文本。" />
            <Textarea v-else :rows="18" :value="astTreeText" readonly />
          </Space>
        </Card>

        <Card title="批量回归结果（examples）" size="small" :bordered="true">
          <div class="dp-promql-showcase__hint">Run all 会对每个用例执行：parsePromqlToAst + parsePromqlToVisualQueryAst，并做最小断言（用于回归）。</div>
          <Divider />
          <Table
            size="small"
            :columns="batchColumns"
            :data-source="batchRows"
            :pagination="{ pageSize: 20, showSizeChanger: true }"
            :row-key="getBatchRowKey"
          />
        </Card>
      </div>
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Alert,
    Button,
    Card,
    ConfigProvider,
    Divider,
    Flex,
    List,
    Segmented,
    Space,
    Switch,
    Table,
    Tabs,
    TabPane,
    Tag,
    Textarea,
    message,
  } from '@grafana-fast/component';
  import { getAppliedDashboardTheme, setDashboardThemePreference, type DashboardTheme } from '@grafana-fast/dashboard';
  import { debugPrintTree, parsePromqlToAst, parsePromqlToVisualQueryAst, type PromqlDiagnostic } from '@grafana-fast/promql';
  import { promQueryModeller } from '@grafana-fast/utils';

  type PromqlExample = {
    key: string;
    title: string;
    expr: string;
    notes?: string;
    expect?: {
      /** 语法是否应通过（parsePromqlToAst.ok） */
      syntaxOk?: boolean;
      /** 最低要求的转换置信度（当转换 ok 时） */
      minConfidence?: 'exact' | 'partial' | 'selector-only';
      /** warnings message 应包含的关键字（子串匹配） */
      warningsContains?: string[];
    };
  };

  const router = useRouter();
  const goHome = () => router.push('/home');
  const goComponents = () => router.push('/components');
  const goJsonEditor = () => router.push('/json-editor');

  const theme = ref<DashboardTheme>(getAppliedDashboardTheme());
  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ] as const;

  const themeModel = computed({
    get: () => theme.value,
    set: (value: DashboardTheme) => {
      theme.value = setDashboardThemePreference(value);
    },
  });

  const examplesCommon: PromqlExample[] = [
    { key: 'sel.basic', title: '简单指标', expr: 'cpu_usage', expect: { syntaxOk: true, minConfidence: 'exact' } },
    {
      key: 'sel.labels',
      title: '带标签匹配',
      expr: 'cpu_usage{instance="server-1",job!="node"}',
      expect: { syntaxOk: true, minConfidence: 'exact' },
    },
    {
      key: 'sel.regex',
      title: '正则标签',
      expr: 'http_requests_total{path=~"/api/.*",method!~"POST|PUT"}',
      expect: { syntaxOk: true, minConfidence: 'exact' },
    },
    {
      key: 'range.grafanaInterval',
      title: 'Grafana $__interval',
      expr: 'rate(cpu_usage[$__interval])',
      expect: { syntaxOk: true, minConfidence: 'exact' },
    },
    {
      key: 'range.grafanaRange',
      title: 'Grafana $__range',
      expr: 'rate(cpu_usage[$__range])',
      expect: { syntaxOk: true },
    },
  ];

  const examplesFunctions: PromqlExample[] = [
    { key: 'agg.sumBy', title: 'sum by', expr: 'sum by (instance) (rate(cpu_usage[5m]))', expect: { syntaxOk: true } },
    { key: 'agg.avgWithout', title: 'avg without', expr: 'avg without (pod) (cpu_usage)', expect: { syntaxOk: true } },
    { key: 'agg.topk', title: 'topk(5, …)', expr: 'topk(5, cpu_usage)', expect: { syntaxOk: true, minConfidence: 'exact' } },
    { key: 'fn.labelReplace', title: 'label_replace', expr: 'label_replace(cpu_usage, "dst", "$1", "src", "(.*)")', expect: { syntaxOk: true } },
    { key: 'fn.labelJoin', title: 'label_join', expr: 'label_join(cpu_usage, "dst", "-", "a", "b")', expect: { syntaxOk: true } },
    {
      key: 'fn.nested.realworld',
      title: '复杂嵌套（真实）',
      expr: 'acos(hour(histogram_quantile(0.9, avg(sum(changes(cpu_usage{instance="server-1"}[$__interval])))))) + 4',
      notes: '来自你实际遇到的 Code → Builder 反解析场景；预期 best-effort 解析 + warnings。',
      expect: { syntaxOk: true },
    },
  ];

  const examplesBinary: PromqlExample[] = [
    { key: 'bin.scalarPlus', title: 'expr + 4', expr: 'cpu_usage + 4', expect: { syntaxOk: true } },
    { key: 'bin.scalarMul', title: '2 * expr', expr: '2 * cpu_usage', expect: { syntaxOk: true } },
    { key: 'bin.boolCmp', title: '> bool', expr: 'cpu_usage > bool 0', expect: { syntaxOk: true } },
    { key: 'bin.matchOn', title: 'on(labels)', expr: 'a + on(instance) b', expect: { syntaxOk: true, minConfidence: 'exact' } },
    {
      key: 'bin.groupLeft',
      title: 'group_left（应告警）',
      expr: 'a + on(instance) group_left(job) b',
      notes: '当前 Builder 模型未支持 group_left/group_right，应产生 warning 并忽略该语义。',
      expect: { syntaxOk: true, minConfidence: 'partial', warningsContains: ['group_left'] },
    },
    {
      key: 'bin.setOp',
      title: 'and/or/unless（可能不支持）',
      expr: 'a and b',
      notes: '用于观察二元集合运算符的支持情况；不支持时应降级并给 warning。',
      expect: { syntaxOk: true },
    },
  ];

  const examplesEdge: PromqlExample[] = [
    { key: 'edge.offset', title: 'offset（应告警）', expr: 'cpu_usage offset 5m', expect: { syntaxOk: true, minConfidence: 'partial', warningsContains: ['offset'] } },
    { key: 'edge.at', title: '@ modifier（应告警）', expr: 'cpu_usage @ 1700000000', expect: { syntaxOk: true, minConfidence: 'partial', warningsContains: ['@'] } },
    {
      key: 'edge.matrixTop',
      title: '矩阵表达式顶层（应降级）',
      expr: 'cpu_usage[5m]',
      notes: 'Builder 无等价基础查询表达；应至少提取 selector 并告警。',
      expect: { syntaxOk: true },
    },
    {
      key: 'edge.subqueryStep',
      title: 'Subquery step（应告警）',
      expr: 'rate(cpu_usage[5m:1m])',
      expect: { syntaxOk: true, minConfidence: 'partial', warningsContains: ['Subquery'] },
    },
    { key: 'err.unclosedBrace', title: '语法错误：缺 }', expr: 'cpu_usage{instance="server-1"', expect: { syntaxOk: false } },
    {
      key: 'err.empty',
      title: '空表达式',
      expr: '',
      notes: '语法层视为“未输入”（不报错）；但 Code→Builder 转换入口会返回 “表达式为空”。',
      expect: { syntaxOk: true },
    },
    {
      key: 'edge.grafanaVariants',
      title: 'Grafana 变量变体',
      expr: 'rate(cpu_usage[${__interval}]) + rate(cpu_usage[[__interval]])',
      notes: '验证 ${__x} 与 [[__x]] 的长度保持替换。',
      expect: { syntaxOk: true },
    },
  ];

  const allExamples = computed(() => [...examplesCommon, ...examplesFunctions, ...examplesBinary, ...examplesEdge]);

  const examplesTab = ref<'common' | 'functions' | 'binary' | 'edge'>('common');
  const activeExampleKey = ref<string>('');
  const activeExample = computed(() => allExamples.value.find((e) => e.key === activeExampleKey.value) ?? null);

  const expr = ref<string>('');

  const astOk = ref<boolean>(false);
  const diagnostics = ref<PromqlDiagnostic[]>([]);
  const astTreeText = ref<string>('');
  // 说明：AST debug 输出可能非常长（尤其是复杂表达式），默认关闭避免页面卡顿
  const astDebugEnabled = ref<boolean>(false);

  const builderOk = ref<boolean>(false);
  const builderConfidence = ref<string>('');
  const builderError = ref<string>('');
  const builderWarnings = ref<any[]>([]);
  const visualQuery = ref<any>(null);

  const diagnosticsCount = computed(() => diagnostics.value.length);
  const warningsCount = computed(() => builderWarnings.value.length);

  const renderedPromql = computed(() => {
    if (!builderOk.value || !visualQuery.value) return '';
    try {
      return promQueryModeller.renderQuery(visualQuery.value);
    } catch (e) {
      return (e as Error)?.message ?? 'renderQuery failed';
    }
  });

  const visualQueryJson = computed(() => {
    if (!builderOk.value || !visualQuery.value) return builderError.value ? `// ${builderError.value}` : '// (empty)';
    try {
      return JSON.stringify(visualQuery.value, null, 2);
    } catch {
      return '// (unstringifiable)';
    }
  });

  const warningsText = computed(() => {
    const w = builderWarnings.value as Array<{ message?: string; snippet?: string; path?: string[] }>;
    if (!w || w.length === 0) return '';
    return w
      .map((x) => {
        const where = x.path && x.path.length > 0 ? `位置：${x.path.join(' → ')}` : '位置：root';
        const snippet = x.snippet ? `片段：${x.snippet}` : '';
        return [x.message || '(warning)', where, snippet].filter(Boolean).join(' | ');
      })
      .join('；');
  });

  const diagnosticItems = computed(() => {
    const list = diagnostics.value ?? [];
    return list.map((d, i) => {
      const range = d.range ? `[${d.range.from}, ${d.range.to}]` : '';
      const snippet = d.range ? snippetAround(expr.value, d.range.from, d.range.to) : '';
      return {
        key: `d_${i}`,
        label: `${i + 1}. ${d.severity} ${range}`,
        value: [d.message, snippet ? `片段：${snippet}` : ''].filter(Boolean).join(' | '),
      };
    });
  });

  function snippetAround(text: string, from: number, to: number) {
    const s = String(text ?? '');
    const start = Math.max(0, Math.min(from, s.length) - 24);
    const end = Math.min(s.length, Math.max(to, 0) + 24);
    const head = start > 0 ? '…' : '';
    const tail = end < s.length ? '…' : '';
    return `${head}${s.slice(start, end).replace(/\s+/g, ' ').trim()}${tail}`;
  }

  // 统一执行：语法 AST + diagnostics + Code->Builder 映射
  function runParse(text: string) {
    const input = String(text ?? '');

    // 1) PromQL -> AST（语法层）
    const astRes = parsePromqlToAst(input);
    astOk.value = astRes.ok;
    diagnostics.value = astRes.diagnostics ?? [];

    // 说明：debugPrintTree 只在用户打开开关时生成，避免默认就把页面卡住
    if (astDebugEnabled.value) {
      try {
        astTreeText.value = debugPrintTree(astRes.ast, input, 10);
      } catch (e) {
        astTreeText.value = (e as Error)?.message ?? 'debugPrintTree failed';
      }
    } else {
      astTreeText.value = '';
    }

    // 2) PromQL -> Builder（映射层）
    const mapped = parsePromqlToVisualQueryAst(input);
    if (!mapped.ok) {
      builderOk.value = false;
      builderError.value = mapped.error || '无法转换为 Builder';
      builderConfidence.value = '';
      builderWarnings.value = [];
      visualQuery.value = null;
      return;
    }

    builderOk.value = true;
    builderError.value = '';
    builderConfidence.value = mapped.confidence;
    builderWarnings.value = mapped.warnings ? [...mapped.warnings] : [];
    visualQuery.value = mapped.value;
  }

  // 手动 run（用于按钮）
  const runNow = () => runParse(expr.value);

  function applyExample(e: PromqlExample) {
    activeExampleKey.value = e.key;
    expr.value = e.expr;
    message.info(`已加载用例：${e.title}`);
    runParse(expr.value);
  }

  // 自动解析：输入变更后 debounce
  let timer: number | null = null;
  watch(
    () => expr.value,
    (v) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => runParse(v), 280);
    },
    { immediate: true }
  );

  // 当用户打开 AST debug 开关时，立刻生成一次（否则需要再手动改动输入才会触发）
  watch(
    () => astDebugEnabled.value,
    (enabled) => {
      if (enabled) runParse(expr.value);
      else astTreeText.value = '';
    }
  );

  type BatchRow = {
    key: string;
    title: string;
    syntax: string;
    diagnostics: number;
    builder: string;
    confidence: string;
    warnings: number;
    expect: string;
  };

  const batchRows = ref<BatchRow[]>([]);
  // 说明：Table 的 rowKey 类型在组件库里是函数签名，这里用函数形式避免 TS 报错
  const getBatchRowKey = (row: BatchRow) => row.key;
  const batchColumns = [
    { title: 'key', dataIndex: 'key', key: 'key', width: 180 },
    { title: 'title', dataIndex: 'title', key: 'title', width: 160 },
    { title: 'syntax', dataIndex: 'syntax', key: 'syntax', width: 90 },
    { title: 'diagnostics', dataIndex: 'diagnostics', key: 'diagnostics', width: 90 },
    { title: 'builder', dataIndex: 'builder', key: 'builder', width: 110 },
    { title: 'confidence', dataIndex: 'confidence', key: 'confidence', width: 120 },
    { title: 'warnings', dataIndex: 'warnings', key: 'warnings', width: 90 },
    { title: 'expect', dataIndex: 'expect', key: 'expect', width: 90 },
  ];

  function confidenceRank(c: string): number {
    if (c === 'exact') return 3;
    if (c === 'partial') return 2;
    if (c === 'selector-only') return 1;
    return 0;
  }

  function runBatch() {
    const rows: BatchRow[] = [];
    for (const e of allExamples.value) {
      const astRes = parsePromqlToAst(e.expr);
      const mapped = parsePromqlToVisualQueryAst(e.expr);

      const syntax = astRes.ok ? 'ok' : 'error';
      const diagnosticsCount = astRes.diagnostics?.length ?? 0;

      const builder = mapped.ok ? 'ok' : 'unsupported';
      const confidence = mapped.ok ? mapped.confidence : '-';
      const warningsCount = mapped.ok ? (mapped.warnings?.length ?? 0) : 0;

      // 最小断言：只做你能长期维护得住的“低耦合期望”
      let expectOk = true;
      const expect = e.expect;
      if (expect?.syntaxOk !== undefined) expectOk = expectOk && expect.syntaxOk === astRes.ok;
      if (expect?.minConfidence && mapped.ok) {
        expectOk = expectOk && confidenceRank(mapped.confidence) >= confidenceRank(expect.minConfidence);
      }
      if (expect?.warningsContains && mapped.ok) {
        const text = (mapped.warnings ?? []).map((w) => String((w as any).message ?? '')).join('\n');
        expectOk = expectOk && expect.warningsContains.every((s) => text.includes(s));
      }

      rows.push({
        key: e.key,
        title: e.title,
        syntax,
        diagnostics: diagnosticsCount,
        builder,
        confidence,
        warnings: warningsCount,
        expect: expectOk ? 'ok' : 'fail',
      });
    }
    batchRows.value = rows;
    const fail = rows.filter((r) => r.expect === 'fail').length;
    if (fail === 0) message.success(`批量回归完成：全部通过（${rows.length}）`);
    else message.warning(`批量回归完成：${fail}/${rows.length} 失败（用于提示需要复查）`);
  }

  // 默认加载一个“真实复杂场景”，方便打开页面直接看到效果
  const defaultExample = allExamples.value.find((e) => e.key === 'fn.nested.realworld') ?? allExamples.value[0]!;
  activeExampleKey.value = defaultExample.key;
  expr.value = defaultExample.expr;
</script>

<style scoped lang="less">
  .dp-promql-showcase {
    padding: 14px 16px 18px;

    &__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    &__h1 {
      font-size: 15px;
      font-weight: 650;
      letter-spacing: 0.2px;
      color: var(--gf-color-text);
    }

    &__sub {
      margin-top: 2px;
      font-size: 12px;
      color: var(--gf-color-text-secondary);
      line-height: 1.5;
      max-width: 820px;
    }

    &__toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    &__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    @media (min-width: 1100px) {
      &__grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    &__hint {
      color: var(--gf-color-text-secondary);
      font-size: 12px;
      line-height: 1.5;
    }

    &__mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    }

    &__example-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  }
</style>
