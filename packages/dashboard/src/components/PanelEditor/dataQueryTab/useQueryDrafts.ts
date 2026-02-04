import { ref } from 'vue';
import type { CanonicalQuery, PromVisualQuery } from '@grafana-fast/types';
import { parsePromqlToVisualQuery } from '@grafana-fast/utils';
import { createPrefixedId, deepClone } from '/#/utils';
import { emptyVisualQuery, indexToRefId, nextRefId, renderPromql } from './helpers';
import type { QueryDraft } from './types';

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
      builder: { status: 'ok', visualQuery: deepClone(persisted), parseWarnings: [], confidence: 'exact', acceptedPartial: true },
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
      builder: {
        status: 'ok',
        visualQuery: deepClone(parsed.value),
        parseWarnings: parsed.warnings ? [...parsed.warnings] : [],
        confidence: parsed.confidence,
        acceptedPartial: parsed.confidence === 'exact',
      },
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
        confidence: parsed.confidence,
        acceptedPartial: false,
        issueType: 'unsupported',
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
      acceptedPartial: false,
      issueType: 'unsupported',
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

export function useQueryDrafts() {
  const queryDrafts = ref<QueryDraft[]>([]);

  function resetFromProps(nextQueries?: CanonicalQuery[]) {
    const input = Array.isArray(nextQueries) ? nextQueries : [];
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

  const markCodeEdited = (index: number) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    d.builder.status = 'unsupported';
    d.builder.issueType = 'unsupported';
    d.builder.message = '已在 Code 模式编辑 PromQL，Builder 需要重新解析（切换到 Builder 会自动尝试）。';
    d.builder.parseWarnings = [];
    d.builder.diagnostics = [];
    d.builder.confidence = undefined;
    d.builder.acceptedPartial = false;
    d.builder.visualQuery = emptyVisualQuery();
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

  const applyPatternToCurrentDraft = (index: number, query: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;

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
  };

  const updateNestedQuery = (index: number, updatedQuery: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.diagnostics = [];
    draft.builder.issueType = undefined;
    draft.builder.confidence = 'exact';
    draft.builder.acceptedPartial = true;
    draft.builder.visualQuery = deepClone(updatedQuery);
  };

  const updateBuilderQuery = (index: number, updatedQuery: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    // partial 未接受时禁止编辑（理论上 UI 已拦截，这里再做一次防御）
    if (draft.builder.confidence && draft.builder.confidence !== 'exact' && !draft.builder.acceptedPartial) {
      return;
    }
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.diagnostics = [];
    draft.builder.issueType = undefined;
    draft.builder.confidence = 'exact';
    draft.builder.acceptedPartial = true;
    draft.builder.visualQuery = deepClone(updatedQuery);
    // 同步 code.expr（不触发执行）
    draft.code.expr = renderPromql(draft.builder.visualQuery);
  };

  // 用户明确确认：接受 partial 转换（将覆盖 code.expr 为 Builder 生成的 PromQL）
  const acceptPartialConversion = (index: number) => {
    const d = queryDrafts.value[index];
    if (!d) return;
    if (d.builder.status !== 'ok') return;
    if (!d.builder.confidence || d.builder.confidence === 'exact') return;

    d.builder.acceptedPartial = true;
    // 明确覆盖：把 Builder 渲染的 PromQL 写回 code.expr（这一步就是“接受过滤/简化”）
    d.code.expr = renderPromql(d.builder.visualQuery);
  };

  return {
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
  };
}
