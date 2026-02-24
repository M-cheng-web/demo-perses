import type { DashboardContent, DashboardVariable, Panel, PanelGroup, PanelLayout } from '@grafana-fast/types';

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

function sanitizePanelLayout(input: unknown): PanelLayout {
  const it = (input ?? {}) as any;
  return {
    i: it.i,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    minW: it.minW,
    minH: it.minH,
    maxW: it.maxW,
    maxH: it.maxH,
    static: it.static,
  } as PanelLayout;
}

function sanitizePanel(input: unknown): Panel {
  const p = (input ?? {}) as any;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    type: p.type,
    queries: p.queries,
    options: p.options,
    transformations: p.transformations,
  } as Panel;
}

function sanitizePanelGroup(input: unknown): PanelGroup {
  const g = (input ?? {}) as any;
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    order: g.order,
    panels: Array.isArray(g.panels) ? g.panels.map(sanitizePanel) : [],
    layout: Array.isArray(g.layout) ? g.layout.map(sanitizePanelLayout) : [],
  } as PanelGroup;
}

function sanitizeVariable(input: unknown): DashboardVariable {
  const v = (input ?? {}) as any;
  return {
    id: v.id,
    name: v.name,
    label: v.label,
    type: v.type,
    query: v.query,
    options: v.options,
    current: v.current,
    multi: v.multi,
    includeAll: v.includeAll,
    allValue: v.allValue,
  } as DashboardVariable;
}

export function sanitizeDashboardContent(input: DashboardContent): DashboardContent {
  // 重要：DashboardContent 只允许“纯内容字段”，用于导入/导出/持久化。
  // 为避免老版本/外部 JSON 带入 dashboardId/id/createdAt 等字段导致“导出泄漏资源标识”，
  // 这里显式 pick 允许的字段，其他字段一律丢弃。
  const raw = deepCloneStructured(input) as any;
  return {
    schemaVersion: raw.schemaVersion,
    name: raw.name,
    description: raw.description,
    panelGroups: Array.isArray(raw.panelGroups) ? raw.panelGroups.map(sanitizePanelGroup) : [],
    variables: Array.isArray(raw.variables) ? raw.variables.map(sanitizeVariable) : raw.variables,
  } as DashboardContent;
}
