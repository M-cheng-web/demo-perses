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
import type { Dashboard } from '@grafana-fast/types';
import { CURRENT_DASHBOARD_SCHEMA_VERSION } from '@grafana-fast/types';
import type { DashboardSummary, JsonTextDiagnostics } from '../types';
import { analyzeJsonText } from './jsonDiagnostics';

export interface DashboardTextDiagnostics {
  /** JSON 文本解析诊断 */
  json: JsonTextDiagnostics;
  /** 是否看起来像 Dashboard JSON（启发式） */
  looksLikeDashboard: boolean;
  /** schemaVersion 是否匹配当前版本（仅 looksLikeDashboard 时有意义） */
  schemaVersionOk?: boolean;
  /** schemaVersion 错误提示（仅 schemaVersionOk=false 时存在） */
  schemaVersionError?: string;
  /** 解析后的 dashboard（仅 json.ok && looksLikeDashboard 时存在） */
  dashboard?: Dashboard;
  /** 精简摘要（仅 json.ok && looksLikeDashboard 时存在） */
  summary?: DashboardSummary;
}

function looksLikeDashboard(value: any): value is Dashboard {
  if (!value || typeof value !== 'object') return false;
  if (!('panelGroups' in value)) return false;
  return Array.isArray((value as any).panelGroups);
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

  const dashboard = value as Dashboard;
  const schemaVersion = (dashboard as any).schemaVersion;
  const schemaVersionOk = schemaVersion === CURRENT_DASHBOARD_SCHEMA_VERSION;
  const panelGroupCount = dashboard.panelGroups?.length ?? 0;
  const panelCount = (dashboard.panelGroups ?? []).reduce((acc, g) => acc + (g.panels?.length ?? 0), 0);
  const variableCount = (dashboard as any).variables?.length ?? 0;

  return {
    json,
    looksLikeDashboard: true,
    schemaVersionOk,
    schemaVersionError: schemaVersionOk
      ? undefined
      : `dashboard.schemaVersion 必须为 ${CURRENT_DASHBOARD_SCHEMA_VERSION}（当前为 ${schemaVersion ?? 'undefined'}）`,
    dashboard,
    summary: {
      panelGroupCount,
      panelCount,
      variableCount,
    },
  };
}
