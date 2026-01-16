/**
 * Dashboard JSON 版本迁移（内部 schemaVersion）
 *
 * 目标：
 * - 支持“复制粘贴 JSON 导入/导出”的长期可用性
 * - 当我们未来调整字段结构时，用户手里旧版本 JSON 仍可导入
 *
 * 原则：
 * - 尽量“宽松”解析：缺字段给默认值，字段类型不对则做归一化
 * - 避免抛异常导致整份 JSON 无法导入（除非结构完全不可用）
 * - 迁移函数返回的是当前版本的 Dashboard 结构（会做一次 normalization）
 */
import type { Dashboard, PanelGroup, Panel, CanonicalQuery, Query, VariablesState, DashboardVariable, VariableOption } from '../index';

export const CURRENT_DASHBOARD_SCHEMA_VERSION = 1 as const;

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeVariableOptions(options: any): VariableOption[] {
  const raw = asArray<any>(options);
  return raw.map((opt) => ({
    text: String(opt?.text ?? opt?.label ?? opt?.value ?? ''),
    value: String(opt?.value ?? opt?.text ?? opt?.label ?? ''),
  }));
}

function normalizeVariable(variable: any): DashboardVariable {
  const v: DashboardVariable = {
    id: String(variable?.id ?? ''),
    name: String(variable?.name ?? ''),
    label: String(variable?.label ?? variable?.name ?? ''),
    type: (variable?.type ?? 'select') as any,
    datasource: variable?.datasource ? String(variable.datasource) : undefined,
    query: variable?.query ? String(variable.query) : undefined,
    options: normalizeVariableOptions(variable?.options),
    current: variable?.current ?? '',
    multi: !!variable?.multi,
    includeAll: !!variable?.includeAll,
    allValue: variable?.allValue ? String(variable.allValue) : undefined,
  };
  return v;
}

function normalizeVariablesState(variables: DashboardVariable[] | undefined): VariablesState {
  const values: Record<string, string | string[]> = {};
  const options: Record<string, VariableOption[]> = {};

  for (const v of variables ?? []) {
    const current = v.current;
    values[v.name] = v.multi
      ? Array.isArray(current)
        ? current
        : current
          ? [String(current)]
          : []
      : Array.isArray(current)
        ? String(current[0] ?? '')
        : String(current ?? '');
    options[v.name] = normalizeVariableOptions(v.options);
  }

  return { values, options, lastUpdatedAt: Date.now() };
}

function toCanonicalQuery(query: any, index: number): CanonicalQuery {
  // Legacy Query shape: { id, datasource, expr, legendFormat, minStep, format, instant, hide }
  const legacy = query as Query;
  const refId = String((query as any)?.refId ?? String.fromCharCode(65 + index));
  const datasource = String((query as any)?.datasource ?? 'prometheus');
  const uid = datasource === 'prometheus' ? 'prometheus-mock' : datasource;
  return {
    id: String(legacy?.id ?? (query as any)?.id ?? `${refId}-${index}`),
    refId,
    datasourceRef: { type: (datasource as any) ?? 'prometheus', uid },
    expr: String((query as any)?.expr ?? ''),
    legendFormat: (query as any)?.legendFormat ? String((query as any).legendFormat) : undefined,
    minStep: typeof (query as any)?.minStep === 'number' ? (query as any).minStep : undefined,
    format: (query as any)?.format ? (query as any).format : undefined,
    instant: typeof (query as any)?.instant === 'boolean' ? (query as any).instant : undefined,
    hide: typeof (query as any)?.hide === 'boolean' ? (query as any).hide : undefined,
  };
}

function normalizePanel(panel: any): Panel {
  const queriesRaw = asArray<any>(panel?.queries);
  const queries = queriesRaw.map((q, i) => toCanonicalQuery(q, i));

  const normalized: Panel = {
    id: String(panel?.id ?? ''),
    name: String(panel?.name ?? ''),
    description: panel?.description ? String(panel.description) : undefined,
    type: String(panel?.type ?? 'timeseries'),
    queries,
    options: isObject(panel?.options) ? panel.options : {},
    transformations: asArray<any>(panel?.transformations).map((t) => ({
      id: String(t?.id ?? ''),
      options: isObject(t?.options) ? t.options : undefined,
    })),
  };
  return normalized;
}

function normalizePanelGroup(group: any): PanelGroup {
  const panels = asArray<any>(group?.panels).map(normalizePanel);
  const layout = asArray<any>(group?.layout).map((l) => ({
    i: String(l?.i ?? ''),
    x: Number(l?.x ?? 0),
    y: Number(l?.y ?? 0),
    w: Number(l?.w ?? 24),
    h: Number(l?.h ?? 8),
    minW: l?.minW != null ? Number(l.minW) : undefined,
    minH: l?.minH != null ? Number(l.minH) : undefined,
  }));

  return {
    id: String(group?.id ?? ''),
    title: String(group?.title ?? ''),
    description: group?.description ? String(group.description) : undefined,
    isCollapsed: !!group?.isCollapsed,
    order: typeof group?.order === 'number' ? group.order : 0,
    panels,
    layout,
  };
}

function migrateV0ToV1(input: any): Dashboard {
  const now = Date.now();
  const variables = asArray<any>(input?.variables).map(normalizeVariable);
  const dashboard: Dashboard = {
    schemaVersion: 1,
    id: String(input?.id ?? 'imported'),
    name: String(input?.name ?? 'Dashboard'),
    description: input?.description ? String(input.description) : undefined,
    panelGroups: asArray<any>(input?.panelGroups).map(normalizePanelGroup),
    timeRange: isObject(input?.timeRange)
      ? { from: input.timeRange.from ?? 'now-1h', to: input.timeRange.to ?? 'now' }
      : { from: 'now-1h', to: 'now' },
    refreshInterval: typeof input?.refreshInterval === 'number' ? input.refreshInterval : 0,
    variables,
    createdAt: typeof input?.createdAt === 'number' ? input.createdAt : now,
    updatedAt: typeof input?.updatedAt === 'number' ? input.updatedAt : now,
  };

  // Attach computed state for runtime (not serialized by default, but consumers can keep it)
  (dashboard as any).__variablesState = normalizeVariablesState(variables);
  return dashboard;
}

/**
 * 将一份“未知来源/未知版本”的 dashboard JSON 迁移为当前 schemaVersion 的 Dashboard。
 *
 * 行为说明：
 * - 不追求严格校验（这是 migration，不是 validator）
 * - 对轻微结构错误尽量容错并填默认值
 * - 返回值保证是一个可被 dashboard runtime 消费的 Dashboard
 */
export function migrateDashboard(input: unknown): Dashboard {
  if (!isObject(input)) {
    return migrateV0ToV1({});
  }

  const version = typeof input.schemaVersion === 'number' ? input.schemaVersion : 0;
  if (version <= 0) return migrateV0ToV1(input);
  if (version === 1) return migrateV0ToV1(input); // normalization pass is still useful

  // Future versions: fall back to current normalization to stay resilient.
  return migrateV0ToV1(input);
}
