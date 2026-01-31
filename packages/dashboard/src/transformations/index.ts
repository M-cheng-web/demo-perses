/**
 * Transformations（数据变换层）
 *
 * 作用：
 * - 查询结果返回后，进入面板渲染前，对数据做可配置的转换
 * - 这使得 panel 类型不必“堆功能”，而是把数据加工能力抽到统一层里
 *
 * 当前内置实现（BUILTIN_TRANSFORMATIONS）：
 * - renameLegend：批量重命名 legend
 * - filterSeriesByLabel：按 label 过滤 series
 * - reduce：对每条 series 做 reduce（last/mean/min/max...）
 *
 * 扩展方式：
 * - registerTransformation(def) 注册自定义变换
 * - Panel JSON 中配置 transformations 链即可生效
 */
import type { PanelTransformation, QueryResult, TimeSeriesData } from '@grafana-fast/types';

export type TransformationApply = (results: QueryResult[], options?: Record<string, unknown>) => QueryResult[];

export interface TransformationDefinition {
  /** transformation 唯一 id（写入 panel.transformations[].id） */
  id: string;
  /** 执行函数：输入 QueryResult[]，输出变换后的 QueryResult[] */
  apply: TransformationApply;
}

function cloneResults(results: QueryResult[]): QueryResult[] {
  return results.map((r) => ({
    ...r,
    data: (r.data ?? []).map((ts) => ({ metric: { ...(ts.metric ?? {}) }, values: [...(ts.values ?? [])] })),
  }));
}

function renameLegend(results: QueryResult[], options: Record<string, unknown> = {}): QueryResult[] {
  const { pattern, replacement } = options;
  if (!pattern) return results;
  const re = new RegExp(String(pattern), 'g');
  const rep = String(replacement ?? '');
  const next = cloneResults(results);
  for (const r of next) {
    for (const series of r.data ?? []) {
      const legend = String((series.metric as any)?.__legend__ ?? (series.metric as any)?.__name__ ?? '');
      (series.metric as any).__legend__ = legend.replace(re, rep);
    }
  }
  return next;
}

function filterSeriesByLabel(results: QueryResult[], options: Record<string, unknown> = {}): QueryResult[] {
  const label = typeof (options as { label?: unknown }).label === 'string' ? ((options as { label?: unknown }).label as string) : '';
  const op = typeof (options as { op?: unknown }).op === 'string' ? ((options as { op?: unknown }).op as string) : '=';
  const value = (options as { value?: unknown }).value;

  if (!label) return results;
  const next = cloneResults(results);

  const match = (series: TimeSeriesData): boolean => {
    const v = (series.metric as any)?.[label];
    const s = v == null ? '' : String(v);
    const target = value == null ? '' : String(value);
    if (op === '=') return s === target;
    if (op === '!=') return s !== target;
    if (op === '=~') return new RegExp(target).test(s);
    if (op === '!~') return !new RegExp(target).test(s);
    return true;
  };

  for (const r of next) {
    r.data = (r.data ?? []).filter(match);
  }

  return next;
}

function reduceSeries(results: QueryResult[], options: Record<string, unknown> = {}): QueryResult[] {
  const { reducer = 'last' } = options;
  const next = cloneResults(results);

  const calc = (values: Array<[number, number]>): number => {
    if (!values.length) return 0;
    if (reducer === 'last') return values[values.length - 1]?.[1] ?? 0;
    if (reducer === 'first') return values[0]?.[1] ?? 0;
    if (reducer === 'min') return Math.min(...values.map((v) => v[1]));
    if (reducer === 'max') return Math.max(...values.map((v) => v[1]));
    if (reducer === 'mean') return values.reduce((sum, v) => sum + v[1], 0) / values.length;
    return values[values.length - 1]?.[1] ?? 0;
  };

  for (const r of next) {
    for (const series of r.data ?? []) {
      const v = calc(series.values as any);
      const t = (series.values?.[series.values.length - 1]?.[0] ?? Date.now()) as any;
      series.values = [[t, Number(v.toFixed(4))]] as any;
    }
  }

  return next;
}

export const BUILTIN_TRANSFORMATIONS: TransformationDefinition[] = [
  { id: 'renameLegend', apply: renameLegend },
  { id: 'filterSeriesByLabel', apply: filterSeriesByLabel },
  { id: 'reduce', apply: reduceSeries },
];

const registry = new Map<string, TransformationDefinition>(BUILTIN_TRANSFORMATIONS.map((t) => [t.id, t]));

export function registerTransformation(def: TransformationDefinition) {
  // 注册/覆盖 transformation（同 id 后注册覆盖先注册）
  registry.set(def.id, def);
}

export function applyTransformations(results: QueryResult[], chain: PanelTransformation[] | undefined): QueryResult[] {
  if (!chain?.length) return results;
  let out = results;
  for (const t of chain) {
    const def = registry.get(t.id);
    if (!def) continue;
    out = def.apply(out, t.options);
  }
  return out;
}
