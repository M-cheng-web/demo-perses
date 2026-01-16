/**
 * 工具说明：JSON 文本解析与错误定位（行/列）
 *
 * 为什么要单独做一层？
 * - 直接使用 JSON.parse 时，错误信息通常缺少可靠的行/列定位
 * - Dashboard 导入/粘贴 JSON 是高频场景，必须把“哪里错了”讲清楚
 */
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { JsonParseError, JsonTextDiagnostics } from '../types';

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  // 行列从 1 开始，符合用户直觉
  let line = 1;
  let lastLineStart = 0;
  const max = Math.min(Math.max(offset, 0), text.length);
  for (let i = 0; i < max; i++) {
    if (text.charCodeAt(i) === 10 /* \\n */) {
      line++;
      lastLineStart = i + 1;
    }
  }
  const column = Math.max(1, max - lastLineStart + 1);
  return { line, column };
}

function formatParseError(text: string, err: ParseError): JsonParseError {
  const { line, column } = offsetToLineColumn(text, err.offset);
  const code = printParseErrorCode(err.error);
  return {
    message: `JSON 解析失败（${code}）`,
    offset: err.offset,
    line,
    column,
  };
}

/**
 * 分析一段 JSON 文本：返回解析结果与错误位置
 *
 * 说明：
 * - 默认允许 JSONC 语法（注释/尾逗号），提升用户粘贴体验
 * - 导出时仍然建议输出严格 JSON（JSON.stringify）
 */
export function analyzeJsonText(text: string): JsonTextDiagnostics {
  const raw = text ?? '';
  const errors: ParseError[] = [];
  const value = parse(raw, errors, { allowTrailingComma: true, disallowComments: false });

  if (errors.length > 0) {
    // 只取第一个错误作为“主错误”（避免一次性刷屏）
    const first = errors[0]!;
    return { ok: false, error: formatParseError(raw, first) };
  }

  return { ok: true, value };
}
