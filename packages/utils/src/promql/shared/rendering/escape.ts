/**
 * PromQL 字符串转义工具
 *
 * 说明：
 * - PromQL 的 string literal 使用双引号："..."
 * - 因此至少需要转义：反斜杠 `\` 与双引号 `"`
 * - 同时处理换行/回车/制表符，避免生成不可见字符导致语法错误
 */

/**
 * 转义为 PromQL string literal 内部内容（不包含外层引号）
 */
export function escapePromqlString(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * 生成 PromQL string literal（包含外层双引号）
 */
export function quotePromqlString(value: string): string {
  return `"${escapePromqlString(value)}"`;
}

