import type { DashboardVariable } from '@grafana-fast/types';

export interface SelectOption {
  label: string;
  value: string;
}

export function extractVariableNameFromToken(raw: string): string | null {
  const text = String(raw ?? '').trim();
  let m = text.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m?.[1]) return m[1];
  m = text.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  if (m?.[1]) return m[1];
  m = text.match(/^\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]$/);
  if (m?.[1]) return m[1];
  return null;
}

function isDurationLikeValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return /^[0-9]+[smhdwy]$/.test(v);
}

function isWindowLikeVariable(v: DashboardVariable): boolean {
  const name = String(v?.name ?? '').toLowerCase();
  const label = String(v?.label ?? '').toLowerCase();
  if (name === 'window' || name === 'interval' || name === 'range' || name === 'step') return true;
  if (label.includes('窗口') || label.includes('间隔') || label.includes('步长')) return true;
  const opts = Array.isArray(v.options) ? v.options : [];
  return opts.some((o) => isDurationLikeValue(o?.value ?? o?.text));
}

/**
 * QueryBuilder：标签过滤 value 下拉的“变量伪选项”
 *
 * 说明：
 * - 仅用于标签过滤（LabelFilters）场景：value 下拉里额外插入 $cluster 等 token
 * - 过滤掉 window/interval 这种“时间窗口”变量（避免出现在标签值里造成误导）
 * - 过滤掉 __xxx 内部变量
 */
export function getLabelFilterVariableOptions(variables: DashboardVariable[] | undefined): SelectOption[] {
  const out: SelectOption[] = [];
  const seen = new Set<string>();
  for (const v of variables ?? []) {
    const name = String(v?.name ?? '').trim();
    if (!name) continue;
    if (name.startsWith('__')) continue;
    if (isWindowLikeVariable(v)) continue;
    const token = `$${name}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ label: token, value: token });
  }
  return out;
}

