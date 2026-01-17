/**
 * 工具说明：严格 JSON 校验器（dashboard 内部使用）
 *
 * 背景：
 * - json-editor 已实现“非法 JSON 不向外同步”的机制，但它只知道“JSON 语法是否可解析”
 * - 业务层还需要更严格的约束：例如 panel.type 必须是内置支持的类型
 *
 * 目标：
 * - 给 dashboard 内的所有 JSON 编辑入口提供统一的“业务校验钩子”
 * - 当用户输入了不符合当前业务约束的内容时：
 *   1) 编辑器内部展示错误
 *   2) 不会把内容同步到外部状态（避免面板预览出现 UnsupportedPanel/缺少插件 等提示）
 *
 * 使用位置（当前仓库）：
 * - DashboardToolbar 的 DashboardJsonEditor（导入/编辑整个 dashboard JSON）
 * - PanelEditorDrawer 的 JsonEditorLite（编辑单个 panel JSON）
 * - 后续扩展：变量管理 JSON、transformations JSON 等
 */

import type { JsonTextValidator } from '@grafana-fast/json-editor';
import type { Dashboard, DashboardVariable } from '@grafana-fast/types';
import { CURRENT_DASHBOARD_SCHEMA_VERSION } from '@grafana-fast/types';
import { isPlainObject } from '@grafana-fast/utils';
import { getBuiltInPanelRegistry } from '/#/runtime/panels';

function supportedPanelTypes(): string[] {
  return getBuiltInPanelRegistry()
    .list()
    .map((p) => p.type)
    .filter((t) => typeof t === 'string' && t.length > 0);
}

function validatePanelObject(panel: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isPlainObject(panel)) {
    errors.push(`${path} 必须是对象`);
    return errors;
  }

  const type = panel.type;
  if (typeof type !== 'string' || !type.trim()) {
    errors.push(`${path}.type 必填`);
    return errors;
  }

  const registry = getBuiltInPanelRegistry();
  if (!registry.has(type)) {
    const allowed = supportedPanelTypes().join(', ');
    errors.push(`${path}.type 不支持：${type}（可选：${allowed}）`);
  }

  // queries 是一个很核心的结构：很多地方假设它是数组
  if ('queries' in panel && !Array.isArray((panel as any).queries)) {
    errors.push(`${path}.queries 必须是数组`);
  }

  // options/transformations 的类型也做一个基本兜底，避免渲染时崩溃
  if ('options' in panel && (panel as any).options != null && !isPlainObject((panel as any).options)) {
    errors.push(`${path}.options 必须是对象`);
  }
  if ('transformations' in panel && (panel as any).transformations != null && !Array.isArray((panel as any).transformations)) {
    errors.push(`${path}.transformations 必须是数组`);
  }

  return errors;
}

function validateVariables(variables: unknown, path: string): string[] {
  const errors: string[] = [];
  if (variables == null) return errors;
  if (!Array.isArray(variables)) {
    errors.push(`${path} 必须是数组`);
    return errors;
  }

  const names = new Set<string>();
  for (let i = 0; i < variables.length; i++) {
    const v = variables[i] as DashboardVariable;
    const p = `${path}[${i}]`;
    if (!isPlainObject(v)) {
      errors.push(`${p} 必须是对象`);
      continue;
    }
    if (typeof v.name !== 'string' || !v.name.trim()) errors.push(`${p}.name 必填`);
    if (typeof v.label !== 'string') errors.push(`${p}.label 必须是 string`);
    if (typeof v.type !== 'string' || !v.type.trim()) errors.push(`${p}.type 必填`);
    if (!Array.isArray((v as any).options)) errors.push(`${p}.options 必须是数组`);

    // current 的类型取决于 multi
    const multi = !!(v as any).multi;
    const current = (v as any).current;
    if (multi) {
      if (!Array.isArray(current)) errors.push(`${p}.current 在 multi=true 时必须是数组`);
    } else {
      if (typeof current !== 'string') errors.push(`${p}.current 在 multi=false 时必须是 string`);
    }

    if (typeof v.name === 'string' && v.name.trim()) {
      if (names.has(v.name)) errors.push(`${p}.name 重复：${v.name}`);
      names.add(v.name);
    }
  }

  return errors;
}

/**
 * 严格校验：Dashboard JSON
 *
 * 注意：
 * - 该函数用于 json-editor 的 validate 钩子，因此签名是 (text, parsedValue)
 * - 当 JSON 语法不合法时，parsedValue 可能为 undefined；语法错误由编辑器内部提示即可
 */
export const validateDashboardStrict: JsonTextValidator = (_text, parsedValue) => {
  if (parsedValue == null) return [];
  if (!isPlainObject(parsedValue)) return ['Dashboard JSON 必须是对象'];

  // 注意：这里不能直接 `as Dashboard`，因为 typescript 会认为类型“重叠不足”并报错；
  // 我们只在校验逻辑里“按需读取字段”，因此通过 unknown 过一层即可。
  const dashboard = parsedValue as unknown as Dashboard;
  const errors: string[] = [];

  // 基础字段校验：避免导入后出现“看似成功，但运行时异常/状态不一致”
  const schemaVersion = (dashboard as any).schemaVersion;
  if (schemaVersion !== CURRENT_DASHBOARD_SCHEMA_VERSION) {
    errors.push(`dashboard.schemaVersion 必须为 ${CURRENT_DASHBOARD_SCHEMA_VERSION}（当前为 ${schemaVersion ?? 'undefined'}）`);
  }

  if (typeof (dashboard as any).name !== 'string' || !(dashboard as any).name.trim()) {
    errors.push('dashboard.name 必填');
  }

  const refreshInterval = (dashboard as any).refreshInterval;
  if (typeof refreshInterval !== 'number' || Number.isNaN(refreshInterval)) {
    errors.push('dashboard.refreshInterval 必须是 number');
  } else if (refreshInterval < 0) {
    errors.push('dashboard.refreshInterval 不能为负数');
  }

  if (!Array.isArray((dashboard as any).panelGroups)) {
    errors.push('dashboard.panelGroups 必须是数组');
    return errors;
  }

  // 面板类型校验：保证不会出现 “缺少插件：xxx” 这类 UI 警告
  (dashboard.panelGroups ?? []).forEach((g: any, gi: number) => {
    const base = `panelGroups[${gi}]`;
    if (!g || typeof g !== 'object') {
      errors.push(`${base} 必须是对象`);
      return;
    }
    const panels = g.panels;
    if (!Array.isArray(panels)) {
      errors.push(`${base}.panels 必须是数组`);
      return;
    }
    panels.forEach((p: unknown, pi: number) => {
      errors.push(...validatePanelObject(p, `${base}.panels[${pi}]`));
    });
  });

  // 变量校验：用于“全局变量管理”场景（通过 JSON 编辑器编辑 variables）
  errors.push(...validateVariables((dashboard as any).variables, 'dashboard.variables'));

  return errors;
};

/**
 * 严格校验：Panel JSON（面板编辑器用）
 */
export const validatePanelStrict: JsonTextValidator = (_text, parsedValue) => {
  if (parsedValue == null) return [];
  return validatePanelObject(parsedValue, 'panel');
};
