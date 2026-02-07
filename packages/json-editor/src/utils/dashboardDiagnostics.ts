/**
 * 工具说明：Dashboard JSON 的轻量诊断（精简版）
 *
 * 目标：
 * - 不做历史 schemaVersion 迁移/兼容（按当前需求：只要 JSON 不合法就提示，合法就交给外部校验）
 * - 仍保留一个“足够实用”的摘要：面板组数量、面板数量、变量数量
 *
 * 说明：
 * - 这里的“looksLikeDashboard”只是启发式判断，用于 UI 提示与阻断“非 dashboard JSON”向外更新。
 */
import type { DashboardContent } from '@grafana-fast/types';
import type { DashboardSummary, JsonTextDiagnostics } from '../types';
import { analyzeJsonText } from './jsonDiagnostics';

export interface DashboardTextDiagnostics {
  /** JSON 文本解析诊断 */
  json: JsonTextDiagnostics;
  /** 是否看起来像 Dashboard JSON（启发式） */
  looksLikeDashboard: boolean;
  /** 解析后的 dashboard（仅 json.ok && looksLikeDashboard 时存在） */
  dashboard?: DashboardContent;
  /** 精简摘要（仅 json.ok && looksLikeDashboard 时存在） */
  summary?: DashboardSummary;
  /**
   * 面板类型统计（仅 json.ok && looksLikeDashboard 时存在）
   * - key: panel.type
   * - value: 该类型面板数量
   */
  panelTypeCounts?: Record<string, number>;
  /**
   * 结构风险提示（仅 json.ok && looksLikeDashboard 时存在）
   * - 不影响“是否合法”判断，只用于帮助用户快速定位潜在风险
   */
  issues?: string[];
}

type DashboardLike = Partial<DashboardContent> & {
  panelGroups?: unknown;
  variables?: unknown;
};

function looksLikeDashboard(value: unknown): value is DashboardLike {
  if (!value || typeof value !== 'object') return false;
  if (!('panelGroups' in value)) return false;
  return Array.isArray((value as DashboardLike).panelGroups);
}

function safeStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function collectPanelTypeCounts(dashboard: DashboardContent): Record<string, number> {
  const counts: Record<string, number> = {};
  const groups = dashboard.panelGroups ?? [];
  for (const g of groups as Array<{ panels?: unknown }>) {
    const panels = Array.isArray(g?.panels) ? (g.panels as Array<{ type?: unknown }>) : [];
    for (const p of panels) {
      const type = safeStr(p?.type).trim();
      if (!type) continue;
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  return counts;
}

function diagnoseStructure(dashboard: DashboardContent): string[] {
  const issues: string[] = [];
  const groups = Array.isArray(dashboard.panelGroups) ? dashboard.panelGroups : [];

  // Duplicate group ids
  const groupIdSeen = new Set<string>();
  const dupGroupIds = new Set<string>();
  for (const g of groups as Array<{ id?: unknown }>) {
    const id = safeStr(g?.id).trim();
    if (!id) continue;
    if (groupIdSeen.has(id)) dupGroupIds.add(id);
    groupIdSeen.add(id);
  }
  if (dupGroupIds.size > 0) {
    issues.push(`存在重复的面板组 id：${Array.from(dupGroupIds).slice(0, 10).join(', ')}${dupGroupIds.size > 10 ? ' ...' : ''}`);
  }

  // Duplicate panel ids (global)
  const panelIdSeen = new Set<string>();
  const dupPanelIds = new Set<string>();
  for (const g of groups as Array<{ panels?: unknown }>) {
    const panels = Array.isArray(g?.panels) ? (g.panels as Array<{ id?: unknown }>) : [];
    for (const p of panels) {
      const id = safeStr(p?.id).trim();
      if (!id) continue;
      if (panelIdSeen.has(id)) dupPanelIds.add(id);
      panelIdSeen.add(id);
    }
  }
  if (dupPanelIds.size > 0) {
    issues.push(`存在重复的 panel id：${Array.from(dupPanelIds).slice(0, 10).join(', ')}${dupPanelIds.size > 10 ? ' ...' : ''}`);
  }

  // Layout consistency (per group)
  for (const g of groups as Array<{ id?: unknown; title?: unknown; panels?: unknown; layout?: unknown }>) {
    const groupId = safeStr(g?.id).trim() || 'unknown';
    const groupTitle = safeStr(g?.title).trim();
    const label = groupTitle ? `${groupTitle}（${groupId}）` : groupId;

    const panels = Array.isArray(g?.panels) ? (g.panels as Array<{ id?: unknown }>) : [];
    const layout = Array.isArray(g?.layout) ? (g.layout as Array<{ i?: unknown }>) : null;
    if (!layout) {
      // layout 允许为空，但如果 panels 不为空，很可能会导致渲染异常
      if (panels.length > 0) issues.push(`面板组 ${label} 缺少 layout（可能导致面板不显示或布局异常）`);
      continue;
    }

    const panelIds = new Set<string>();
    for (const p of panels) {
      const id = safeStr(p?.id).trim();
      if (id) panelIds.add(id);
    }

    const layoutIds = new Set<string>();
    for (const it of layout) {
      const id = safeStr(it?.i).trim();
      if (id) layoutIds.add(id);
    }

    let missing = 0;
    panelIds.forEach((id) => {
      if (!layoutIds.has(id)) missing++;
    });
    let orphan = 0;
    layoutIds.forEach((id) => {
      if (!panelIds.has(id)) orphan++;
    });

    if (missing > 0) issues.push(`面板组 ${label} 有 ${missing} 个面板缺少 layout 项`);
    if (orphan > 0) issues.push(`面板组 ${label} 有 ${orphan} 条 layout 引用不存在的面板（可能是历史残留）`);
  }

  return issues;
}

/**
 * Dashboard JSON 的轻量诊断
 *
 * @param text   用户粘贴/导入的 JSON 文本
 */
export function analyzeDashboardText(text: string): DashboardTextDiagnostics {
  const json = analyzeJsonText(text);
  if (!json.ok) {
    return { json, looksLikeDashboard: false };
  }

  const value = json.value;
  if (!looksLikeDashboard(value)) {
    return { json, looksLikeDashboard: false };
  }

  const dashboard = value as DashboardContent;
  const panelGroupCount = dashboard.panelGroups?.length ?? 0;
  const panelCount = (dashboard.panelGroups ?? []).reduce((acc, g) => acc + (g.panels?.length ?? 0), 0);
  const variableCount = Array.isArray(dashboard.variables) ? dashboard.variables.length : 0;
  const panelTypeCounts = collectPanelTypeCounts(dashboard);
  const issues = diagnoseStructure(dashboard);

  return {
    json,
    looksLikeDashboard: true,
    dashboard,
    summary: {
      panelGroupCount,
      panelCount,
      variableCount,
    },
    panelTypeCounts,
    issues,
  };
}
