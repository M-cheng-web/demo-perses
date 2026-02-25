import { ref } from 'vue';
import type { CanonicalQuery, PromVisualQuery } from '@grafana-fast/types';
import { parsePromqlToVisualQuery } from '@grafana-fast/utils';
import { createPrefixedId, deepClone } from '/#/utils';
import { emptyVisualQuery, indexToRefId, nextRefId, renderPromql } from './helpers';
import type { QueryDraft } from './types';

function buildDraftFromCanonical(q: CanonicalQuery, fallbackRefId: string): QueryDraft {
  const refId = (q.refId || fallbackRefId).trim() || fallbackRefId;
  const id = q.id || createPrefixedId('q');

  const expr = String(q.expr ?? '');
  const parsed = expr.trim() ? parsePromqlToVisualQuery(expr) : null;

  // 约定：默认优先进入 Builder；仅当“无法 exact 反解析”时降级到 Code
  const canUseBuilder = !expr.trim() || (parsed?.ok && parsed.confidence === 'exact');

  if (canUseBuilder) {
    const visual = !expr.trim()
      ? emptyVisualQuery()
      : (deepClone((parsed as Extract<typeof parsed, { ok: true }>).value) as PromVisualQuery);
    const nextExpr = expr.trim() ? renderPromql(visual) : '';
    return {
      id,
      refId,
      hide: !!q.hide,
      collapsed: false,
      mode: 'builder',
      showExplain: false,
      code: {
        expr: nextExpr,
        legendFormat: String(q.legendFormat ?? ''),
        minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
      },
      builder: {
        status: 'ok',
        issueType: undefined,
        message: undefined,
        parseWarnings: (parsed && parsed.ok && parsed.warnings) ? [...parsed.warnings] : [],
        confidence: parsed && parsed.ok ? parsed.confidence : 'exact',
        diagnostics: [],
        visualQuery: visual,
      },
    };
  }

  const messageFromWarnings = (warnings?: Array<{ message?: unknown }>) => {
    const head = warnings?.[0]?.message;
    return typeof head === 'string' && head.trim() ? head.trim() : '';
  };

  const fallbackMessage =
    parsed && parsed.ok
      ? `该 PromQL 无法完整反解析为 QueryBuilder（confidence=${parsed.confidence}），已切换到 Code 模式。`
      : `该 PromQL 暂无法反解析为 QueryBuilder，已切换到 Code 模式。`;
  const errText = parsed && !parsed.ok ? String(parsed.error ?? '').trim() : '';
  const issueType: NonNullable<QueryDraft['builder']['issueType']> = parsed && !parsed.ok ? 'syntax' : 'unsupported';

  return {
    id,
    refId,
    hide: !!q.hide,
    collapsed: false,
    mode: 'code',
    showExplain: false,
    code: {
      expr,
      legendFormat: String(q.legendFormat ?? ''),
      minStep: typeof q.minStep === 'number' && q.minStep > 0 ? q.minStep : 15,
    },
    builder: {
      status: 'unsupported',
      issueType,
      message: errText || messageFromWarnings(parsed && parsed.ok ? parsed.warnings : undefined) || fallbackMessage,
      parseWarnings: parsed && parsed.ok && parsed.warnings ? [...parsed.warnings] : [],
      confidence: parsed && parsed.ok ? parsed.confidence : undefined,
      diagnostics: [],
      visualQuery: parsed && parsed.ok ? deepClone(parsed.value) : emptyVisualQuery(),
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
          mode: 'builder',
          showExplain: false,
          code: { expr: '', legendFormat: '', minStep: 15 },
          builder: { status: 'ok', visualQuery: emptyVisualQuery() },
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

  const addQuery = () => {
    const used = new Set(queryDrafts.value.map((d) => d.refId));
    const refId = nextRefId(used);
    queryDrafts.value.push({
      id: createPrefixedId('q'),
      refId,
      hide: false,
      collapsed: false,
      mode: 'builder',
      showExplain: false,
      code: { expr: '', legendFormat: '', minStep: 15 },
      builder: { status: 'ok', visualQuery: emptyVisualQuery() },
    });
  };

  const removeQuery = (index: number) => {
    queryDrafts.value.splice(index, 1);
  };

  const updateNestedQuery = (index: number, updatedQuery: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.confidence = 'exact';
    draft.builder.diagnostics = [];
    draft.builder.issueType = undefined;
    draft.builder.visualQuery = deepClone(updatedQuery);
    draft.code.expr = renderPromql(draft.builder.visualQuery);
  };

  const updateBuilderQuery = (index: number, updatedQuery: PromVisualQuery) => {
    const draft = queryDrafts.value[index];
    if (!draft) return;
    draft.builder.status = 'ok';
    draft.builder.message = undefined;
    draft.builder.parseWarnings = [];
    draft.builder.confidence = 'exact';
    draft.builder.diagnostics = [];
    draft.builder.issueType = undefined;
    draft.builder.visualQuery = deepClone(updatedQuery);
    draft.code.expr = renderPromql(draft.builder.visualQuery);
  };

  const switchQueryMode = (index: number, nextMode: QueryDraft['mode']): { ok: true } | { ok: false; message: string } => {
    const draft = queryDrafts.value[index];
    if (!draft) return { ok: false, message: 'Query draft not found' };

    const mode = nextMode === 'builder' ? 'builder' : 'code';
    if (mode === draft.mode) return { ok: true };

    if (mode === 'code') {
      // builder -> code：确保把当前 Builder 的表达式同步到 code.expr
      if (draft.builder.status === 'ok') {
        draft.code.expr = renderPromql(draft.builder.visualQuery);
      }
      draft.mode = 'code';
      return { ok: true };
    }

    // code -> builder：检查是否能 exact 反解析到 Builder
    const expr = String(draft.code.expr ?? '').trim();
    if (!expr) {
      draft.builder.status = 'ok';
      draft.builder.issueType = undefined;
      draft.builder.message = undefined;
      draft.builder.parseWarnings = [];
      draft.builder.confidence = 'exact';
      draft.builder.diagnostics = [];
      draft.builder.visualQuery = emptyVisualQuery();
      draft.mode = 'builder';
      return { ok: true };
    }

    const parsed = parsePromqlToVisualQuery(expr);
    if (parsed.ok && parsed.confidence === 'exact') {
      draft.builder.status = 'ok';
      draft.builder.issueType = undefined;
      draft.builder.message = undefined;
      draft.builder.parseWarnings = parsed.warnings ? [...parsed.warnings] : [];
      draft.builder.confidence = parsed.confidence;
      draft.builder.diagnostics = [];
      draft.builder.visualQuery = deepClone(parsed.value);
      // 同步：保证 Builder/Code 看到的是同一份 expr（canonical form）
      draft.code.expr = renderPromql(draft.builder.visualQuery);
      draft.mode = 'builder';
      return { ok: true };
    }

    const msg = parsed.ok
      ? `无法切换到 QueryBuilder：该表达式无法完整反解析（confidence=${parsed.confidence}）。请继续使用 Code 模式。`
      : `无法切换到 QueryBuilder：${String(parsed.error ?? '解析失败')}`;

    draft.builder.status = 'unsupported';
    draft.builder.issueType = parsed.ok ? 'unsupported' : 'syntax';
    draft.builder.message = msg;
    draft.builder.parseWarnings = parsed.ok && parsed.warnings ? [...parsed.warnings] : [];
    draft.builder.confidence = parsed.ok ? parsed.confidence : undefined;
    draft.builder.diagnostics = [];
    draft.builder.visualQuery = parsed.ok ? deepClone(parsed.value) : emptyVisualQuery();
    // 关键：保持在 code 模式
    draft.mode = 'code';
    return { ok: false, message: msg };
  };

  return {
    queryDrafts,
    resetFromProps,
    togglePanelCollapsed,
    toggleQueryVisibility,
    addQuery,
    removeQuery,
    updateNestedQuery,
    updateBuilderQuery,
    switchQueryMode,
  };
}
