import type { CanonicalQuery, DashboardContent, DashboardVariable, Panel, PanelGroup, PanelLayout, PanelTransformation } from '@grafana-fast/types';

import { deepCloneStructured } from '/#/utils';

export function yieldToPaint(): Promise<void> {
  // 用 setTimeout(0) 让浏览器有机会先渲染 loading mask，避免“先卡住再出现遮罩”
  return new Promise((r) => window.setTimeout(r, 0));
}

export function safeUtf8Bytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    // 兜底：近似值（UTF-16 code units）
    return text.length * 2;
  }
}

export function countDashboardStats(d: DashboardContent): { groupCount: number; panelCount: number } {
  const groups = d.panelGroups ?? [];
  let panelCount = 0;
  for (const g of groups) {
    panelCount += g.panels?.length ?? 0;
  }
  return { groupCount: groups.length, panelCount };
}

export function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function normalizeVariableCurrent(def: DashboardVariable, value: unknown): string | string[] {
  const multi = !!def.multi;
  if (multi) {
    if (Array.isArray(value)) return value.map((v) => String(v));
    const v = String(value ?? '').trim();
    return v ? [v] : [];
  }
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizePanelLayout(input: unknown): PanelLayout {
  const it = (input ?? {}) as any;
  const toNum = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    i: String(it.i ?? ''),
    x: toNum(it.x, 0),
    y: toNum(it.y, 0),
    w: Math.max(1, toNum(it.w, 1)),
    h: Math.max(1, toNum(it.h, 1)),
    minW: typeof it.minW === 'number' && Number.isFinite(it.minW) ? it.minW : undefined,
    minH: typeof it.minH === 'number' && Number.isFinite(it.minH) ? it.minH : undefined,
    maxW: typeof it.maxW === 'number' && Number.isFinite(it.maxW) ? it.maxW : undefined,
    maxH: typeof it.maxH === 'number' && Number.isFinite(it.maxH) ? it.maxH : undefined,
    static: typeof it.static === 'boolean' ? it.static : undefined,
  } as PanelLayout;
}

function sanitizeCanonicalQuery(input: unknown): CanonicalQuery {
  const q = (isPlainObject(input) ? input : {}) as any;
  return {
    ...q,
    id: String(q.id ?? ''),
    refId: String(q.refId ?? ''),
    expr: String(q.expr ?? ''),
  } as CanonicalQuery;
}

function sanitizeTransformation(input: unknown): PanelTransformation {
  const t = (isPlainObject(input) ? input : {}) as any;
  const opt = t.options;
  return {
    ...t,
    id: String(t.id ?? ''),
    options: isPlainObject(opt) ? opt : undefined,
  } as PanelTransformation;
}

function sanitizePanel(input: unknown): Panel {
  const p = (input ?? {}) as any;
  const rawQueries = Array.isArray(p.queries) ? p.queries : [];
  const rawTransformations = Array.isArray(p.transformations) ? p.transformations : undefined;
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    description: typeof p.description === 'string' ? p.description : undefined,
    type: String(p.type ?? ''),
    queries: rawQueries.map(sanitizeCanonicalQuery),
    options: isPlainObject(p.options) ? p.options : {},
    transformations: rawTransformations ? rawTransformations.map(sanitizeTransformation) : undefined,
  } as Panel;
}

function sanitizePanelGroup(input: unknown, index: number): PanelGroup {
  const g = (input ?? {}) as any;
  const order = typeof g.order === 'number' && Number.isFinite(g.order) && g.order >= 0 ? g.order : index;
  return {
    id: String(g.id ?? ''),
    title: String(g.title ?? ''),
    description: typeof g.description === 'string' ? g.description : undefined,
    order,
    panels: Array.isArray(g.panels) ? g.panels.map(sanitizePanel) : [],
    layout: Array.isArray(g.layout) ? g.layout.map(sanitizePanelLayout) : [],
  } as PanelGroup;
}

export function sanitizeDashboardContent(input: DashboardContent): DashboardContent {
  // 重要：DashboardContent 只允许“纯内容字段”，用于导入/导出/持久化。
  // 为避免导入 JSON 带入 dashboardId/id/createdAt 等字段导致“导出泄漏资源标识”，
  // 这里显式 pick 允许的字段，其他字段一律丢弃。
  const raw = deepCloneStructured(input) as any;
  const schemaVersion = typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion) ? raw.schemaVersion : 1;
  return {
    schemaVersion,
    name: String(raw.name ?? ''),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    panelGroups: Array.isArray(raw.panelGroups) ? raw.panelGroups.map((g: unknown, idx: number) => sanitizePanelGroup(g, idx)) : [],
  } as DashboardContent;
}
