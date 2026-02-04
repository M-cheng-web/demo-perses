import type { PromVisualQuery } from '@grafana-fast/types';
import { parsePromqlToVisualQuery, type PromqlParseConfidence, type PromqlParseWarning } from '@grafana-fast/utils';
import { parsePromqlToAst, type PromqlDiagnostic } from './parser';
import { astToVisualQuery } from './astToVisualQuery';

export type ParsePromqlToVisualQueryAstResult =
  | {
      ok: true;
      confidence: PromqlParseConfidence;
      value: PromVisualQuery;
      warnings?: PromqlParseWarning[];
      /** 语法诊断（带范围），用于编辑器高质量提示 */
      diagnostics?: PromqlDiagnostic[];
    }
  | {
      ok: false;
      error: string;
      /** 语法诊断（带范围），用于编辑器高质量提示 */
      diagnostics?: PromqlDiagnostic[];
    };

/**
 * PromQL -> VisualQuery（AST 版本入口，编辑器专用）
 *
 * 设计原则：
 * - 语法层：使用 lezer-promql（通过 parsePromqlToAst 拿到 AST + diagnostics）
 * - 映射层：AST -> PromVisualQuery（并对不支持的语义给出 warnings）
 * - 兜底：如果 AST 映射暂时覆盖不到某些边界情况，回退到 utils 的字符串 best-effort parser（保证可用）
 */
export function parsePromqlToVisualQueryAst(expr: string): ParsePromqlToVisualQueryAstResult {
  const text = String(expr ?? '').trim();
  if (!text) return { ok: false, error: '表达式为空' };

  const ast = parsePromqlToAst(text);
  if (!ast.ok) {
    return { ok: false, error: 'PromQL 语法错误，无法转换为 Builder', diagnostics: ast.diagnostics };
  }

  // 先使用 AST 映射（更规范、更容易扩展）
  const mapped = astToVisualQuery(ast.ast, text);
  if (mapped.ok) {
    return { ok: true, confidence: mapped.confidence, value: mapped.value, warnings: mapped.warnings, diagnostics: ast.diagnostics };
  }

  // 兜底：回退到旧的字符串 best-effort parser（避免阻塞用户工作流）
  const fallback = parsePromqlToVisualQuery(text);
  if (fallback.ok) {
    return {
      ok: true,
      confidence: fallback.confidence,
      value: fallback.value,
      warnings: fallback.warnings,
      diagnostics: ast.diagnostics,
    };
  }

  return { ok: false, error: mapped.error || fallback.error, diagnostics: ast.diagnostics };
}
