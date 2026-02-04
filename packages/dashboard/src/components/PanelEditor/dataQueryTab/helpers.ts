import type { CanonicalQuery, Datasource, DatasourceRef, DatasourceType, PromVisualQuery } from '@grafana-fast/types';
import { promQueryModeller } from '@grafana-fast/utils';
import type { PromqlParseWarning } from '@grafana-fast/utils';
import type { QueryDraft } from './types';

export function signatureFromCanonical(queries: CanonicalQuery[] | undefined): string {
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

export function emptyVisualQuery(): PromVisualQuery {
  return { metric: '', labels: [], operations: [] };
}

export function indexToRefId(index: number): string {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function nextRefId(used: Set<string>): string {
  for (let i = 0; i < 10_000; i++) {
    const id = indexToRefId(i);
    if (!used.has(id)) return id;
  }
  return `${indexToRefId(0)}_${Math.random().toString(16).slice(2, 6)}`;
}

export function normalizeDatasourceType(type: unknown): DatasourceType {
  const t = String(type ?? '').trim();
  if (t === 'prometheus' || t === 'influxdb' || t === 'elasticsearch') return t;
  return 'prometheus';
}

export function getDatasourceRef(datasource: Pick<Datasource, 'id' | 'type'> | null | undefined): DatasourceRef {
  const uid = datasource?.id ? String(datasource.id) : 'prometheus-mock';
  const type = normalizeDatasourceType(datasource?.type);
  return { type, uid };
}

export function renderPromql(query: PromVisualQuery): string {
  try {
    return promQueryModeller.renderQuery(query);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to render PromQL:', error);
    return '';
  }
}

export function getPromQLForDraft(draft: QueryDraft): string {
  // 关键：partial 未接受时，不允许“隐式覆盖原 PromQL”，仍以 code.expr 为准（避免语义变化）
  if (draft.builder.status === 'ok') {
    const okToUseBuilder = draft.builder.confidence === 'exact' || !!draft.builder.acceptedPartial;
    if (okToUseBuilder) return renderPromql(draft.builder.visualQuery);
  }
  return draft.code.expr || '';
}

// 将 PromQL 反解析 warnings（结构化）格式化成可读的中文提示文本（用于 Builder 底部 Alert 展示）
export function formatParseWarnings(warnings?: PromqlParseWarning[]): string {
  if (!warnings || warnings.length === 0) return '';
  return warnings
    .map((w) => {
      const where = w.path && w.path.length > 0 ? `位置：${w.path.join(' → ')}` : '位置：root';
      const snippet = w.snippet ? `片段：${w.snippet}` : '';
      return [w.message, where, snippet].filter(Boolean).join(' | ');
    })
    .join('；');
}

export function formatDiagnostics(diagnostics?: any[]): string {
  if (!diagnostics || diagnostics.length === 0) return '';
  return diagnostics
    .map((d) => {
      const r = d?.range;
      const range = r && typeof r.from === 'number' && typeof r.to === 'number' ? `位置：${r.from}-${r.to}` : '';
      const msg = d?.message ? String(d.message) : 'PromQL 语法错误';
      return [msg, range].filter(Boolean).join(' | ');
    })
    .join('；');
}
