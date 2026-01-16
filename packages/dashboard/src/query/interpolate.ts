/**
 * 变量插值与依赖分析
 *
 * 功能：
 * - 从表达式中提取变量引用（用于“变量变化只刷新受影响面板”的依赖分析）
 * - 将 $var / ${var} / [[var]] 等语法替换为实际值
 *
 * 说明：
 * - multi 变量提供不同渲染策略（regex/csv）
 * - includeAll/allValue 兼容 Grafana 常用语义
 */
export interface InterpolationOptions {
  /**
   * 当变量开启 includeAll 且当前值包含 all 时，使用该值替代。
   * - PromQL label matcher 常用 '.*'
   */
  defaultAllValue?: string;
  /**
   * multi 变量拼接策略：
   * - regex：a|b|c（适合 PromQL 正则匹配）
   * - csv：a,b,c（适合逗号分隔语义）
   */
  multiJoin?: 'regex' | 'csv';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractVariableRefs(expr: string): Set<string> {
  const refs = new Set<string>();
  if (!expr) return refs;

  // $var（Grafana 风格）
  for (const match of expr.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    if (match[1]) refs.add(match[1]);
  }
  // ${var}（JS template 风格）
  for (const match of expr.matchAll(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) {
    if (match[1]) refs.add(match[1]);
  }
  // [[var]]（Grafana 旧风格）
  for (const match of expr.matchAll(/\[\[([a-zA-Z_][a-zA-Z0-9_]*)\]\]/g)) {
    if (match[1]) refs.add(match[1]);
  }

  return refs;
}

export function interpolateExpr(
  expr: string,
  values: Record<string, string | string[]>,
  variableMeta: Record<string, { includeAll?: boolean; allValue?: string; multi?: boolean }> = {},
  options: InterpolationOptions = {}
): string {
  if (!expr) return expr;
  const { defaultAllValue = '.*', multiJoin = 'regex' } = options;

  const resolveValue = (name: string): string => {
    const raw = values[name];
    const meta = variableMeta[name] ?? {};
    const includeAll = !!meta.includeAll;
    const allValue = meta.allValue ?? defaultAllValue;

    const isAll = (v: string) => v === 'all' || v === '__all__';

    if (Array.isArray(raw)) {
      if (includeAll && raw.some(isAll)) return allValue;
      if (multiJoin === 'csv') return raw.join(',');
      return raw.map((v) => escapeRegex(String(v))).join('|');
    }

    const v = raw == null ? '' : String(raw);
    if (includeAll && isAll(v)) return allValue;
    return v;
  };

  const replacer = (_m: string, name: string) => resolveValue(name);

  // 重要：先替换 ${var}，避免后续 $var 的正则把它重复替换。
  let out = expr.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, replacer);
  out = out.replace(/\[\[([a-zA-Z_][a-zA-Z0-9_]*)\]\]/g, replacer);
  out = out.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, replacer);
  return out;
}
