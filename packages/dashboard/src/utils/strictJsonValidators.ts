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
 *   2) 不会把内容同步到外部状态（避免面板预览出现 UnsupportedPanel/不支持类型 等提示）
 *
 * 使用位置（当前仓库）：
 * - DashboardToolbar 的 DashboardJsonEditor（导入/编辑整个 dashboard JSON）
 * - PanelEditorDrawer 的 JsonEditorLite（编辑单个 panel JSON）
 * - 后续扩展：变量管理 JSON、transformations JSON 等
 */

import type { JsonTextValidator } from '@grafana-fast/json-editor';
import type { DashboardContent, DashboardVariable, PanelLayout } from '@grafana-fast/types';
import { isBuiltInPanelType, listBuiltInPanelTypes } from '../panels/builtInPanelTypes';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function supportedPanelTypes(): string[] {
  return listBuiltInPanelTypes();
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

  // 注意：导入 JSON 必须严格符合当前契约；query 中不允许出现 datasource/datasourceRef（数据源由后端决定）。
  if ('datasourceRef' in (query as any)) errors.push(`${path}.datasourceRef 不支持（前端不接受 datasourceRef；由后端决定数据源）`);
  if ('datasource' in (query as any)) errors.push(`${path}.datasource 不支持（请使用本项目导出的 JSON 格式）`);

  const q = query as {
    id?: unknown;
    refId?: unknown;
    expr?: unknown;
    visualQuery?: unknown;
    legendFormat?: unknown;
    minStep?: unknown;
    format?: unknown;
    instant?: unknown;
    hide?: unknown;
  };

  if (typeof q.id !== 'string' || !q.id.trim()) errors.push(`${path}.id 必填`);
  if (typeof q.refId !== 'string' || !q.refId.trim()) errors.push(`${path}.refId 必填`);
  if (typeof q.expr !== 'string' || !q.expr.trim()) errors.push(`${path}.expr 必填`);

  if ('visualQuery' in q && q.visualQuery != null && typeof q.visualQuery !== 'object') {
    errors.push(`${path}.visualQuery 必须是对象`);
  }
  if ('legendFormat' in q && q.legendFormat != null && typeof q.legendFormat !== 'string') {
    errors.push(`${path}.legendFormat 必须是 string`);
  }

  if (!isFiniteNumber(q.minStep) || q.minStep <= 0) errors.push(`${path}.minStep 必填且必须为正数`);
  if (q.format !== 'time_series') errors.push(`${path}.format 必须为 "time_series"`);
  if (typeof q.instant !== 'boolean') errors.push(`${path}.instant 必填且必须为 boolean`);
  if (typeof q.hide !== 'boolean') errors.push(`${path}.hide 必填且必须为 boolean`);

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
    options?: unknown;
    transformations?: unknown;
  };

  if (typeof panelObj.id !== 'string' || !panelObj.id.trim()) errors.push(`${path}.id 必填`);
  if (typeof panelObj.name !== 'string' || !panelObj.name.trim()) errors.push(`${path}.name 必填`);

  const type = panelObj.type;
  if (typeof type !== 'string' || !type.trim()) {
    errors.push(`${path}.type 必填`);
    return errors;
  }

  if (!isBuiltInPanelType(type)) {
    const allowed = supportedPanelTypes().join(', ');
    errors.push(`${path}.type 不支持：${type}（可选：${allowed}）`);
  }

  // queries 是一个很核心的结构：很多地方假设它是数组
  if (!Array.isArray(panelObj.queries)) {
    errors.push(`${path}.queries 必须是数组`);
  } else {
    if (panelObj.queries.length === 0) errors.push(`${path}.queries 至少需要 1 条查询`);
    panelObj.queries.forEach((q, qi) => {
      errors.push(...validateCanonicalQueryObject(q, `${path}.queries[${qi}]`));
    });
  }

  // options/transformations 的类型也做一个基本兜底，避免渲染时崩溃
  if (!isPlainObject(panelObj.options)) {
    errors.push(`${path}.options 必须是对象`);
  }
  if ('transformations' in panelObj && panelObj.transformations != null && !Array.isArray(panelObj.transformations)) {
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
    if (typeof v.id !== 'string' || !v.id.trim()) errors.push(`${p}.id 必填`);
    if (typeof v.name !== 'string' || !v.name.trim()) errors.push(`${p}.name 必填`);
    if (typeof v.label !== 'string') errors.push(`${p}.label 必须是 string`);
    const type = v.type;
    if (type !== 'select' && type !== 'input' && type !== 'constant' && type !== 'query') {
      errors.push(`${p}.type 不支持：${String(type ?? 'undefined')}`);
    }
    const options = v.options;
    if (options != null && !Array.isArray(options)) errors.push(`${p}.options 必须是数组`);

    if (type === 'query') {
      if (typeof v.query !== 'string' || !v.query.trim()) errors.push(`${p}.query 在 type="query" 时必填`);
    }

    // current 的类型取决于 multi
    const multi = !!v.multi;
    const current = v.current;
    if (multi) {
      if (!(Array.isArray(current) || typeof current === 'string')) errors.push(`${p}.current 在 multi=true 时必须是 string 或 string[]`);
    } else {
      if (!(typeof current === 'string' || Array.isArray(current))) errors.push(`${p}.current 在 multi=false 时必须是 string 或 string[]`);
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

  const dashboard = parsedValue as Partial<DashboardContent> & {
    panelGroups?: unknown;
    variables?: unknown;
    schemaVersion?: unknown;
    name?: unknown;
    refreshInterval?: unknown;
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

  if ('description' in dashboard && dashboard.description != null && typeof dashboard.description !== 'string') {
    errors.push('dashboard.description 必须是 string');
  }

  const refreshInterval = dashboard.refreshInterval;
  if (typeof refreshInterval !== 'number' || Number.isNaN(refreshInterval)) {
    errors.push('dashboard.refreshInterval 必须是 number');
  } else if (refreshInterval < 0) {
    errors.push('dashboard.refreshInterval 不能为负数');
  }

  // timeRange 是查询与变量解析的核心上下文字段
  const tr = (dashboard as any).timeRange;
  if (!isPlainObject(tr)) {
    errors.push('dashboard.timeRange 必须是对象');
  } else {
    const from = (tr as any).from;
    const to = (tr as any).to;
    const isTimeValue = (v: unknown) => typeof v === 'number' || typeof v === 'string';
    if (!isTimeValue(from)) errors.push('dashboard.timeRange.from 必填且必须是 number 或 string');
    if (!isTimeValue(to)) errors.push('dashboard.timeRange.to 必填且必须是 number 或 string');
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

    const groupObj = group as { id?: unknown; title?: unknown; isCollapsed?: unknown; order?: unknown; panels?: unknown; layout?: unknown };

    if (typeof groupObj.id !== 'string' || !groupObj.id.trim()) errors.push(`${base}.id 必填`);
    if (typeof groupObj.title !== 'string' || !groupObj.title.trim()) errors.push(`${base}.title 必填`);
    if (typeof groupObj.isCollapsed !== 'boolean') errors.push(`${base}.isCollapsed 必填且必须是 boolean`);
    if (!isFiniteNumber(groupObj.order) || groupObj.order < 0) errors.push(`${base}.order 必填且必须是非负 number`);

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
        if (layoutIds.has(i)) errors.push(`${p}.i 重复：${i}`);
        layoutIds.add(i);
      }

      const maybeNumber = (v: unknown) => v == null || isFiniteNumber(v);
      const fields: Array<keyof PanelLayout> = ['minW', 'minH', 'maxW', 'maxH'];
      for (const f of fields) {
        if (!maybeNumber((it as any)[f])) errors.push(`${p}.${String(f)} 必须是 number`);
      }
      const s = (it as any).static;
      if (s != null && typeof s !== 'boolean') errors.push(`${p}.static 必须是 boolean`);
    }

    // panels 与 layout 必须一一对应
    for (const panelId of panelIds) {
      if (!panelId) continue;
      if (!layoutIds.has(panelId)) errors.push(`${base}.layout 缺失：panelId=${panelId}`);
    }
    for (const layoutId of layoutIds) {
      if (!layoutId) continue;
      if (!panelIds.has(layoutId)) errors.push(`${base}.layout 多余：panelId=${layoutId}`);
    }
  });

  // 变量校验：用于“全局变量管理”场景（通过 JSON 编辑器编辑 variables）
  errors.push(...validateVariables(dashboard.variables, 'dashboard.variables'));

  return errors;
};

/**
 * 严格校验：Panel JSON（面板编辑器用）
 */
export const validatePanelStrict: JsonTextValidator = (_text, parsedValue) => {
  if (parsedValue == null) return [];
  return validatePanelObject(parsedValue, 'panel');
};
