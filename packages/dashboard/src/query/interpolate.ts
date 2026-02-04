/**
 * 变量插值（PromQL/表达式）
 *
 * 说明：
 * - 当前阶段实现“最常见、最可控”的变量替换：
 *   - $var
 *   - ${var}
 *   - [[var]]
 * - 不处理 Grafana 的内置宏（例如 $__interval / $__range），避免误伤；这些以 `$__` 开头会被保留。
 *
 * 设计目标：
 * - 轻量、可预测、可用于执行链路（QueryScheduler -> QueryRunner）
 * - 未匹配到的变量默认保留原样（让错误更可解释）
 */

export type VariableValue = string | string[];

export interface InterpolateExprOptions {
  /**
   * 多选变量的格式化方式
   * - regex：a|b|c（用于 label =~ 的常见场景）
   * - csv：a,b,c（用于日志/字符串拼接场景）
   */
  multiFormat?: 'regex' | 'csv';
  /**
   * 未找到变量时的行为
   * - keep：保留原 token（默认）
   * - empty：替换为 ''（可能导致 PromQL 语法错误，但能避免把 $var 发给后端）
   */
  unknown?: 'keep' | 'empty';
}

function formatValue(value: VariableValue, options: Required<Pick<InterpolateExprOptions, 'multiFormat'>>): string {
  if (Array.isArray(value)) {
    const list = value.map((v) => String(v));
    if (options.multiFormat === 'csv') return list.join(',');
    // default: regex
    return list.join('|');
  }
  return String(value);
}

function replaceVarToken(full: string, name: string, values: Record<string, VariableValue>, options: Required<InterpolateExprOptions>): string {
  // 保留 Grafana 的内置宏/变量（避免误伤，例如 $__interval）
  if (name.startsWith('__')) return full;

  if (!(name in values)) {
    return options.unknown === 'empty' ? '' : full;
  }

  return formatValue(values[name] as VariableValue, options);
}

export function interpolateExpr(expr: string, values: Record<string, VariableValue>, options: InterpolateExprOptions = {}): string {
  const input = String(expr ?? '');
  const opts: Required<InterpolateExprOptions> = {
    multiFormat: options.multiFormat ?? 'regex',
    unknown: options.unknown ?? 'keep',
  };

  // 先处理 ${var} 与 [[var]]，再处理 $var（避免重复匹配）
  const replaced1 = input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (full, name: string) => replaceVarToken(full, name, values, opts));
  const replaced2 = replaced1.replace(/\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]/g, (full, name: string) => replaceVarToken(full, name, values, opts));

  // $var：避免匹配 ${...} / [[...]]（已先处理），并限制变量名规则
  return replaced2.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (full, name: string) => replaceVarToken(full, name, values, opts));
}
