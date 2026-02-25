/**
 * 工具说明：严格 JSON 校验器（dashboard 内部使用）
 *
 * 背景：
 * - json-editor 已实现“非法 JSON 不向外同步”的机制，但它只知道“JSON 语法是否可解析”
 * - 业务层还需要基本的“结构兜底”，避免把明显缺字段的内容同步到运行时导致崩溃
 *
 * 目标：
 * - 给 dashboard 内的所有 JSON 编辑入口提供统一的“业务校验钩子”
 * - 当用户输入了不符合当前业务约束的内容时：
 *   1) 编辑器内部展示错误
 *   2) 不会把内容同步到外部状态（避免面板预览出现 UnsupportedPanel/不支持类型 等提示）
 *
 * 使用位置（当前仓库）：
 * - DashboardToolbar 的 DashboardJsonEditor（导入/编辑整个 dashboard JSON）
 * - PanelEditorDrawer 的 JsonEditorLite（编辑单个 panel JSON）
 * - 后续扩展：变量管理 JSON、transformations JSON 等
 */

import type { JsonTextValidator } from '@grafana-fast/json-editor';
import type { DashboardContent } from '@grafana-fast/types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateCanonicalQueryObject(query: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isPlainObject(query)) {
    errors.push(`${path} 必须是对象`);
    return errors;
  }

  const q = query as {
    id?: unknown;
    refId?: unknown;
    expr?: unknown;
  };

  if (typeof q.id !== 'string' || !q.id.trim()) errors.push(`${path}.id 必填`);
  if (typeof q.refId !== 'string' || !q.refId.trim()) errors.push(`${path}.refId 必填`);
  if (typeof q.expr !== 'string' || !q.expr.trim()) errors.push(`${path}.expr 必填`);

  return errors;
}

function validatePanelObject(panel: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isPlainObject(panel)) {
    errors.push(`${path} 必须是对象`);
    return errors;
  }

  const panelObj = panel as {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    queries?: unknown;
  };

  if (typeof panelObj.id !== 'string' || !panelObj.id.trim()) errors.push(`${path}.id 必填`);
  if (typeof panelObj.name !== 'string' || !panelObj.name.trim()) errors.push(`${path}.name 必填`);

  const type = panelObj.type;
  if (typeof type !== 'string' || !type.trim()) {
    errors.push(`${path}.type 必填`);
    return errors;
  }

  // queries 是一个很核心的结构：很多地方假设它是数组
  if (!Array.isArray(panelObj.queries)) {
    errors.push(`${path}.queries 必须是数组`);
  } else {
    panelObj.queries.forEach((q, qi) => {
      errors.push(...validateCanonicalQueryObject(q, `${path}.queries[${qi}]`));
    });
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

  const dashboard = parsedValue as Partial<DashboardContent> & {
    panelGroups?: unknown;
    schemaVersion?: unknown;
    name?: unknown;
  };
  const errors: string[] = [];

  // 基础字段校验：避免导入后出现“看似成功，但运行时异常/状态不一致”
  const schemaVersion = dashboard.schemaVersion;
  if (typeof schemaVersion !== 'number' || Number.isNaN(schemaVersion)) {
    errors.push(`dashboard.schemaVersion 必填且必须是 number（当前为 ${schemaVersion ?? 'undefined'}）`);
  }

  if (typeof dashboard.name !== 'string' || !dashboard.name.trim()) {
    errors.push('dashboard.name 必填');
  }

  if (!Array.isArray(dashboard.panelGroups)) {
    errors.push('dashboard.panelGroups 必须是数组');
    return errors;
  }

  (dashboard.panelGroups ?? []).forEach((group, gi: number) => {
    const base = `panelGroups[${gi}]`;
    if (!group || typeof group !== 'object') {
      errors.push(`${base} 必须是对象`);
      return;
    }

    const groupObj = group as { id?: unknown; title?: unknown; order?: unknown; panels?: unknown; layout?: unknown };

    if (typeof groupObj.id !== 'string' || !groupObj.id.trim()) errors.push(`${base}.id 必填`);
    if (typeof groupObj.title !== 'string' || !groupObj.title.trim()) errors.push(`${base}.title 必填`);

    const panels = groupObj.panels;
    if (!Array.isArray(panels)) {
      errors.push(`${base}.panels 必须是数组`);
      return;
    }
    panels.forEach((p: unknown, pi: number) => {
      errors.push(...validatePanelObject(p, `${base}.panels[${pi}]`));
    });

    const layout = groupObj.layout;
    if (!Array.isArray(layout)) {
      errors.push(`${base}.layout 必须是数组`);
      return;
    }

    const panelIds = new Set(panels.map((p: any) => String(p?.id ?? '')));
    const layoutIds = new Set<string>();
    for (let li = 0; li < layout.length; li++) {
      const it = layout[li] as unknown;
      const p = `${base}.layout[${li}]`;
      if (!isPlainObject(it)) {
        errors.push(`${p} 必须是对象`);
        continue;
      }

      const i = (it as any).i;
      const x = (it as any).x;
      const y = (it as any).y;
      const w = (it as any).w;
      const h = (it as any).h;
      if (typeof i !== 'string' || !i.trim()) errors.push(`${p}.i 必填`);
      if (!isFiniteNumber(x)) errors.push(`${p}.x 必填且必须是 number`);
      if (!isFiniteNumber(y)) errors.push(`${p}.y 必填且必须是 number`);
      if (!isFiniteNumber(w)) errors.push(`${p}.w 必填且必须是 number`);
      if (!isFiniteNumber(h)) errors.push(`${p}.h 必填且必须是 number`);

      if (typeof i === 'string' && i.trim()) {
        layoutIds.add(i);
      }
    }

    // panels 与 layout 必须一一对应
    for (const panelId of panelIds) {
      if (!panelId) continue;
      if (!layoutIds.has(panelId)) errors.push(`${base}.layout 缺失：panelId=${panelId}`);
    }
  });

  return errors;
};

/**
 * 严格校验：Panel JSON（面板编辑器用）
 */
export const validatePanelStrict: JsonTextValidator = (_text, parsedValue) => {
  if (parsedValue == null) return [];
  return validatePanelObject(parsedValue, 'panel');
};
