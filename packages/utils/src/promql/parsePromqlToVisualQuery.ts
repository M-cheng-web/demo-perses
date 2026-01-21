import type { PromVisualQuery, QueryBuilderLabelFilter, QueryBuilderOperation } from '@grafana-fast/types';
import { PromOperationId } from '@grafana-fast/types';
import { aggById, aggWithoutId } from './ids';
import { promQueryModeller } from './PromQueryModeller';

export type PromqlParseConfidence = 'exact' | 'partial' | 'selector-only';

export type PromqlParseWarningCode = 'UNKNOWN_WRAPPER' | 'UNPARSED_EXPRESSION';

export interface PromqlParseWarning {
  code: PromqlParseWarningCode;
  message: string;
  /**
   * 发生告警时解析器所处的位置（操作链路：外层 → 内层）
   * - 示例：['Acos', 'Hour', 'Histogram quantile']
   */
  path?: string[];
  /**
   * 未能解析/被过滤的 PromQL 片段（用于提示用户）
   */
  snippet?: string;
}

export type ParsePromqlToVisualQueryResult =
  | { ok: true; confidence: PromqlParseConfidence; value: PromVisualQuery; warnings?: PromqlParseWarning[] }
  | { ok: false; error: string };

/** 是否为标识符起始字符（PromQL 标识符） */
function isIdentStart(ch: string): boolean {
  return /[a-zA-Z_:]/.test(ch);
}

/** 是否为标识符字符（PromQL 标识符） */
function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_:]/.test(ch);
}

/** 跳过空白字符 */
function skipSpaces(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i]!)) i++;
  return i;
}

/** 读取一个标识符（例如函数名、指标名） */
function readIdent(text: string, start: number): { ok: true; value: string; next: number } | { ok: false; error: string } {
  const i = skipSpaces(text, start);
  if (i >= text.length) return { ok: false, error: '期望标识符，但已到达末尾' };
  if (!isIdentStart(text[i]!)) return { ok: false, error: `期望标识符，位置 ${i}` };
  let j = i + 1;
  while (j < text.length && isIdentChar(text[j]!)) j++;
  return { ok: true, value: text.slice(i, j), next: j };
}

/** 读取标签匹配运算符（= != =~ !~） */
function readOp(text: string, start: number): { ok: true; value: QueryBuilderLabelFilter['op']; next: number } | { ok: false; error: string } {
  const i = skipSpaces(text, start);
  const two = text.slice(i, i + 2);
  if (two === '!=') return { ok: true, value: '!=', next: i + 2 };
  if (two === '=~') return { ok: true, value: '=~', next: i + 2 };
  if (two === '!~') return { ok: true, value: '!~', next: i + 2 };
  const one = text[i];
  if (one === '=') return { ok: true, value: '=', next: i + 1 };
  return { ok: false, error: `期望标签运算符，位置 ${i}` };
}

/** 读取 PromQL 的双引号字符串（支持简单转义） */
function readQuotedString(text: string, start: number): { ok: true; value: string; next: number } | { ok: false; error: string } {
  let i = skipSpaces(text, start);
  if (text[i] !== '"') return { ok: false, error: `期望 '\"'，位置 ${i}` };
  i++;
  let out = '';
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '"') {
      return { ok: true, value: out, next: i + 1 };
    }
    if (ch === '\\') {
      const n = text[i + 1];
      if (n == null) return { ok: false, error: '字符串转义序列未闭合' };
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else out += n;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return { ok: false, error: '字符串未闭合' };
}

/** 在文本中寻找与 `{` 对应的 `}`（忽略字符串内部） */
function findMatchingBrace(text: string, openIndex: number): number | null {
  if (text[openIndex] !== '{') return null;
  let i = openIndex + 1;
  let inString = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }
    if (ch === '}') return i;
    i++;
  }
  return null;
}

/** 在文本中寻找与 `(` 对应的 `)`（忽略字符串内部） */
function findMatchingParen(text: string, openIndex: number): number | null {
  if (text[openIndex] !== '(') return null;
  let i = openIndex + 1;
  let depth = 1;
  let inString = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) return i;
    i++;
  }
  return null;
}

/** 解析标签匹配器列表：`a="b",job=~"x"` */
function parseLabelMatchers(inner: string): { ok: true; value: QueryBuilderLabelFilter[] } | { ok: false; error: string } {
  const labels: QueryBuilderLabelFilter[] = [];
  let i = 0;

  while (true) {
    i = skipSpaces(inner, i);
    if (i >= inner.length) break;

    const name = readIdent(inner, i);
    if (!name.ok) return { ok: false, error: name.error };
    i = name.next;

    const op = readOp(inner, i);
    if (!op.ok) return { ok: false, error: op.error };
    i = op.next;

    const val = readQuotedString(inner, i);
    if (!val.ok) return { ok: false, error: val.error };
    i = val.next;

    labels.push({ label: name.value, op: op.value, value: val.value });

    i = skipSpaces(inner, i);
    if (i >= inner.length) break;
    if (inner[i] === ',') {
      i++;
      continue;
    }
    return { ok: false, error: `期望 ',' 或结束，位置 ${i}` };
  }

  return { ok: true, value: labels };
}

/** 构造一个空的可视化查询模型（用于兜底） */
function buildEmptyQuery(): PromVisualQuery {
  return { metric: '', labels: [], operations: [] };
}

/** 去掉最外层的成对括号（只去掉“完全包裹”的那一层） */
function stripOuterParens(text: string): string {
  let s = text.trim();
  for (let i = 0; i < 50; i++) {
    if (!s.startsWith('(')) break;
    const close = findMatchingParen(s, 0);
    if (close == null) break;
    if (skipSpaces(s, close + 1) !== s.length) break;
    s = s.slice(1, close).trim();
  }
  return s;
}

/** 截断提示片段，避免告警文案太长 */
function truncateSnippet(text: string, maxLen: number = 120): string {
  const s = text.trim().replace(/\s+/g, ' ');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/** 按“顶层逗号”拆分参数列表（忽略括号/花括号/方括号/字符串内部） */
function splitTopLevelArgs(text: string): string[] {
  const args: string[] = [];
  let start = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;

    if (ch === ',' && paren === 0 && brace === 0 && bracket === 0) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last.length) args.push(last);
  return args;
}

/** 解析 PromQL 字符串字面量（双引号） */
function parsePromqlStringLiteral(arg: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = arg.trim();
  if (!s.startsWith('"')) return { ok: false, error: '期望双引号字符串' };
  const r = readQuotedString(s, 0);
  if (!r.ok) return { ok: false, error: r.error };
  if (skipSpaces(s, r.next) !== s.length) return { ok: false, error: '字符串字面量后存在多余字符' };
  return { ok: true, value: r.value };
}

/** 解析数字字面量 */
function parseNumberLiteral(arg: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = arg.trim();
  if (!s) return { ok: false, error: '数字为空' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, error: '非法数字' };
  return { ok: true, value: n };
}

/** 解析布尔字面量 */
function parseBoolLiteral(arg: string): { ok: true; value: boolean } | { ok: false; error: string } {
  const s = arg.trim();
  if (s === 'true') return { ok: true, value: true };
  if (s === 'false') return { ok: true, value: false };
  return { ok: false, error: '非法布尔值' };
}

/** 判断表达式是否为“完整 selector”（`指标` 或 `指标{...}`），并解析出指标/labels */
function parseSelectorExact(text: string): { ok: true; metric: string; labels: QueryBuilderLabelFilter[] } | { ok: false } {
  const s = stripOuterParens(text);
  const id = readIdent(s, 0);
  if (!id.ok) return { ok: false };
  const afterId = skipSpaces(s, id.next);
  if (afterId === s.length) return { ok: true, metric: id.value, labels: [] };
  if (s[afterId] !== '{') return { ok: false };
  const close = findMatchingBrace(s, afterId);
  if (close == null) return { ok: false };
  const rest = skipSpaces(s, close + 1);
  if (rest !== s.length) return { ok: false };
  const inner = s.slice(afterId + 1, close);
  const labels = parseLabelMatchers(inner);
  if (!labels.ok) return { ok: false };
  return { ok: true, metric: id.value, labels: labels.value };
}

/** 从复杂表达式里尽力提取第一个 selector（用于兜底：至少拿到指标/labels） */
function extractFirstSelector(text: string): { ok: true; metric: string; labels: QueryBuilderLabelFilter[]; snippet: string } | { ok: false } {
  const s = String(text ?? '');
  // 找到第一个 `metric{...}` 出现位置
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const close = findMatchingBrace(s, i);
    if (close == null) continue;

    let j = i - 1;
    while (j >= 0 && /\s/.test(s[j]!)) j--;
    const end = j + 1;
    while (j >= 0 && isIdentChar(s[j]!)) j--;
    const start = j + 1;
    const metric = s.slice(start, end);
    if (!metric || !isIdentStart(metric[0]!)) continue;

    const inner = s.slice(i + 1, close);
    const labels = parseLabelMatchers(inner);
    if (!labels.ok) continue;

    return { ok: true, metric, labels: labels.value, snippet: s.slice(start, close + 1) };
  }

  // 兜底：如果是纯 metric
  const exact = parseSelectorExact(s);
  if (exact.ok) return { ok: true, metric: exact.metric, labels: exact.labels, snippet: exact.metric };

  return { ok: false };
}

/**
 * 解析聚合的 `by/without` 形式：
 * - `sum by(job)(expr)`
 * - `sum without(instance)(expr)`
 */
function parseAggregation(expr: string): { ok: true; op: QueryBuilderOperation; inner: string } | { ok: false } {
  const s = stripOuterParens(expr);
  const id = readIdent(s, 0);
  if (!id.ok) return { ok: false };
  const name = id.value;
  const opDef = promQueryModeller.getOperationDef(name);
  // 只处理“已知的聚合操作”，否则可能是同名函数/未知语法
  if (!opDef || opDef.category !== 'Aggregations') return { ok: false };

  let i = skipSpaces(s, id.next);

  // 形态：sum by(label1, label2)(expr) / sum without(label)(expr)
  const mode = (() => {
    const afterBy = s[i + 2];
    if (s.slice(i, i + 2) === 'by' && (afterBy == null || /\s|\(/.test(afterBy))) return 'by' as const;
    const afterWithout = s[i + 7];
    if (s.slice(i, i + 7) === 'without' && (afterWithout == null || /\s|\(/.test(afterWithout))) return 'without' as const;
    return null;
  })();

  if (!mode) return { ok: false };

  i = skipSpaces(s, i + (mode === 'by' ? 2 : 7));
  if (s[i] !== '(') return { ok: false };
  const labelsClose = findMatchingParen(s, i);
  if (labelsClose == null) return { ok: false };
  const labelsRaw = s.slice(i + 1, labelsClose);
  const labels = splitTopLevelArgs(labelsRaw)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  i = skipSpaces(s, labelsClose + 1);
  if (s[i] !== '(') return { ok: false };
  const innerClose = findMatchingParen(s, i);
  if (innerClose == null) return { ok: false };
  if (skipSpaces(s, innerClose + 1) !== s.length) return { ok: false };
  const inner = s.slice(i + 1, innerClose).trim();

  if (labels.length === 0) {
    return { ok: true, op: { id: name, params: [] }, inner };
  }

  return {
    ok: true,
    op: {
      id: mode === 'by' ? aggById(name) : aggWithoutId(name),
      params: [...labels],
    },
    inner,
  };
}

/** 从 `innerExpr[range]` 中提取 `innerExpr` 与 `range`（用于范围向量参数） */
function extractRangeVectorArg(arg: string): { ok: true; innerExpr: string; range: string } | { ok: false } {
  const s = stripOuterParens(arg);
  if (!s.endsWith(']')) return { ok: false };
  let bracketDepth = 0;
  let inString = false;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i]!;
    if (inString) {
      if (ch === '"' && s[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === ']') {
      bracketDepth++;
      continue;
    }
    if (ch === '[') {
      bracketDepth--;
      if (bracketDepth === 0) {
        const innerExpr = s.slice(0, i).trim();
        const range = s.slice(i + 1, s.length - 1).trim();
        if (!innerExpr || !range) return { ok: false };
        return { ok: true, innerExpr, range };
      }
    }
  }
  return { ok: false };
}

/**
 * 按 operationDef.params 的定义把 args 解析为 params
 * - 支持 number/boolean/string
 * - 支持 restParam
 */
function parseParamsByDefs(paramArgs: string[], paramDefs: Array<{ type: any; restParam?: boolean; optional?: boolean }>): { ok: true; params: any[] } | { ok: false } {
  const defs = Array.isArray(paramDefs) ? paramDefs : [];
  const out: any[] = [];

  const restIndex = defs.findIndex((d) => d.restParam);
  const fixedCount = restIndex >= 0 ? restIndex : defs.length;
  if (paramArgs.length < fixedCount) return { ok: false };
  if (restIndex < 0 && paramArgs.length !== defs.length) return { ok: false };

  const parseOne = (arg: string, def: any): { ok: true; value: any } | { ok: false } => {
    if (!def) return { ok: false };
    if (def.type === 'number') {
      const n = parseNumberLiteral(arg);
      if (!n.ok) return { ok: false };
      return { ok: true, value: n.value };
    }
    if (def.type === 'boolean') {
      const b = parseBoolLiteral(arg);
      if (!b.ok) return { ok: false };
      return { ok: true, value: b.value };
    }
    // string（PromQL 里通常会被双引号包裹）
    const str = parsePromqlStringLiteral(arg);
    if (str.ok) return { ok: true, value: str.value };
    // 兜底：允许不带引号的字符串（best-effort）
    return { ok: true, value: arg.trim() };
  };

  for (let i = 0; i < fixedCount; i++) {
    const v = parseOne(paramArgs[i]!, defs[i]);
    if (!v.ok) return { ok: false };
    out.push(v.value);
  }

  if (restIndex >= 0) {
    const restDef = defs[restIndex];
    for (let i = restIndex; i < paramArgs.length; i++) {
      const v = parseOne(paramArgs[i]!, restDef);
      if (!v.ok) return { ok: false };
      out.push(v.value);
    }
  }

  return { ok: true, params: out };
}

/**
 * 解析“函数包裹”：
 * - `acos(inner)`
 * - `histogram_quantile(0.9, inner)`
 * - `label_join(inner, "dst", ",", "src1", "src2")`
 *
 * 注意：
 * - 如果遇到未知函数，但参数只有 1 个，则当作“未知 wrapper”，可选择过滤并继续向内解析。
 */
function parseFunctionWrapper(expr: string): { ok: true; op: QueryBuilderOperation; inner: string } | { ok: false; filteredAsUnknown?: boolean; inner?: string; name?: string } {
  const s = stripOuterParens(expr);
  const id = readIdent(s, 0);
  if (!id.ok) return { ok: false };
  const name = id.value;
  let i = skipSpaces(s, id.next);
  if (s[i] !== '(') return { ok: false };
  const close = findMatchingParen(s, i);
  if (close == null) return { ok: false };
  if (skipSpaces(s, close + 1) !== s.length) return { ok: false };

  const args = splitTopLevelArgs(s.slice(i + 1, close));
  const opDef = promQueryModeller.getOperationDef(name);
  if (!opDef) {
    // 未知函数：如果只有 1 个参数，则可当作“外层 wrapper”，过滤并继续解析 inner
    if (args.length === 1) return { ok: false, filteredAsUnknown: true, inner: args[0]!, name };
    return { ok: false };
  }

  if (args.length === 0) return { ok: false };

  const paramDefs = opDef.params ?? [];
  const hasRangeParam = paramDefs[0]?.name === 'Range';

  // 范围向量：`op(innerExpr[range])` 或 `op(p1, innerExpr[range])` / `op(innerExpr[range], p1)`
  if (hasRangeParam) {
    const lastRange = extractRangeVectorArg(args[args.length - 1]!);
    if (lastRange.ok) {
      const otherParams = parseParamsByDefs(args.slice(0, -1), paramDefs.slice(1));
      if (!otherParams.ok) return { ok: false };
      return { ok: true, op: { id: name, params: [lastRange.range, ...otherParams.params] }, inner: lastRange.innerExpr };
    }
    const firstRange = extractRangeVectorArg(args[0]!);
    if (firstRange.ok) {
      const otherParams = parseParamsByDefs(args.slice(1), paramDefs.slice(1));
      if (!otherParams.ok) return { ok: false };
      return { ok: true, op: { id: name, params: [firstRange.range, ...otherParams.params] }, inner: firstRange.innerExpr };
    }
  }

  const parseInnerLast = () => {
    const inner = args[args.length - 1]!;
    const parsed = parseParamsByDefs(args.slice(0, -1), paramDefs);
    if (!parsed.ok) return null;
    return { op: { id: name, params: parsed.params }, inner };
  };

  const parseInnerFirst = () => {
    const inner = args[0]!;
    const parsed = parseParamsByDefs(args.slice(1), paramDefs);
    if (!parsed.ok) return null;
    return { op: { id: name, params: parsed.params }, inner };
  };

  // 一些函数会渲染成 `op(innerExpr, ...)`（例如 label_replace/label_join），优先按这种尝试
  const preferInnerFirst = name === PromOperationId.LabelReplace || name === PromOperationId.LabelJoin;
  const r = (preferInnerFirst ? parseInnerFirst() ?? parseInnerLast() : parseInnerLast() ?? parseInnerFirst()) as any;
  if (!r) return { ok: false };
  return { ok: true, op: r.op, inner: r.inner };
}

/** 从表达式中找出“顶层二元标量运算”（例如 `expr + 4`） */
function findTopLevelBinaryScalar(expr: string): { ok: true; left: string; op: string; right: string } | { ok: false } {
  const s = stripOuterParens(expr);
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let inString = false;
  const ops = ['==', '!=', '>=', '<=', '+', '-', '*', '/', '%', '^', '>', '<'] as const;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i]!;
    if (inString) {
      if (ch === '"' && s[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === ')') paren++;
    else if (ch === '(') paren--;
    else if (ch === '}') brace++;
    else if (ch === '{') brace--;
    else if (ch === ']') bracket++;
    else if (ch === '[') bracket--;

    if (paren !== 0 || brace !== 0 || bracket !== 0) continue;

    for (const op of ops) {
      const len = op.length;
      if (i - len + 1 < 0) continue;
      const slice = s.slice(i - len + 1, i + 1);
      if (slice !== op) continue;
      const left = s.slice(0, i - len + 1).trim();
      const right = s.slice(i + 1).trim();
      if (!left || !right) continue;
      return { ok: true, left, op, right };
    }
  }
  return { ok: false };
}

/** 把 `expr <op> number` 的形式反解析为 QueryBuilder 的“二元标量操作” */
function parseBinaryScalarWrapper(expr: string): { ok: true; op: QueryBuilderOperation; inner: string } | { ok: false } {
  const found = findTopLevelBinaryScalar(expr);
  if (!found.ok) return { ok: false };

  const map: Record<string, PromOperationId> = {
    '+': PromOperationId.Addition,
    '-': PromOperationId.Subtraction,
    '*': PromOperationId.MultiplyBy,
    '/': PromOperationId.DivideBy,
    '%': PromOperationId.Modulo,
    '^': PromOperationId.Exponent,
    '==': PromOperationId.EqualTo,
    '!=': PromOperationId.NotEqualTo,
    '>': PromOperationId.GreaterThan,
    '<': PromOperationId.LessThan,
    '>=': PromOperationId.GreaterOrEqual,
    '<=': PromOperationId.LessOrEqual,
  };
  const opId = map[found.op];
  if (!opId) return { ok: false };

  // 比较运算可能带 `bool` 后缀（PromQL 语法）
  const right = found.right;
  const m = right.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s+bool)?\s*$/);
  if (!m) return { ok: false };
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return { ok: false };
  const hasBool = /\sbool\s*$/.test(right);
  const isComparison = ['==', '!=', '>', '<', '>=', '<='].includes(found.op);
  const params = isComparison ? [num, hasBool] : [num];
  return { ok: true, op: { id: opId, params }, inner: found.left };
}

/**
 * PromQL -> PromVisualQuery 的 best-effort 反解析器
 *
 * 目标：
 * - 支持把 Builder 渲染出来的 PromQL 再反解析回 VisualQuery（函数/聚合/范围函数/二元标量运算）
 * - 对无法识别的片段：尽量“漏过/过滤”，同时返回 warnings（confidence: partial/selector-only）
 */
export function parsePromqlToVisualQuery(expr: string): ParsePromqlToVisualQueryResult {
  const text = String(expr ?? '').trim();
  if (!text) return { ok: false, error: '表达式为空' };

  const warnings: PromqlParseWarning[] = [];
  const collectedOuterToInner: QueryBuilderOperation[] = [];
  let current = stripOuterParens(text);

  const currentPath = (): string[] => {
    // 给用户展示的位置路径：外层 → 内层
    return collectedOuterToInner
      .map((op) => promQueryModeller.getOperationDef(op.id)?.name || op.id)
      .filter((v) => String(v).trim().length > 0);
  };

  const warn = (warning: Omit<PromqlParseWarning, 'path'>) => {
    const path = currentPath();
    warnings.push({
      ...warning,
      path: path.length ? path : undefined,
    });
  };

  for (let iter = 0; iter < 200; iter++) {
    current = stripOuterParens(current);

    const sel = parseSelectorExact(current);
    if (sel.ok) {
      return {
        ok: true,
        confidence: warnings.length > 0 ? 'partial' : 'exact',
        value: { metric: sel.metric, labels: sel.labels, operations: collectedOuterToInner.reverse() },
        warnings: warnings.length ? warnings : undefined,
      };
    }

    const bin = parseBinaryScalarWrapper(current);
    if (bin.ok) {
      collectedOuterToInner.push(bin.op);
      current = bin.inner;
      continue;
    }

    const agg = parseAggregation(current);
    if (agg.ok) {
      collectedOuterToInner.push(agg.op);
      current = agg.inner;
      continue;
    }

    const fn = parseFunctionWrapper(current);
    if (fn.ok) {
      collectedOuterToInner.push(fn.op);
      current = fn.inner;
      continue;
    }

    if (fn.filteredAsUnknown && fn.inner && fn.name) {
      warn({
        code: 'UNKNOWN_WRAPPER',
        message: `未识别函数：${fn.name}（已过滤）`,
        snippet: truncateSnippet(current),
      });
      current = fn.inner;
      continue;
    }

    // 无法继续向内拆解时：尽量提取 selector 并停止
    const extracted = extractFirstSelector(current);
    if (extracted.ok) {
      warn({
        code: 'UNPARSED_EXPRESSION',
        message: `未完全反解析（已提取 ${truncateSnippet(extracted.snippet)}）`,
        snippet: truncateSnippet(current),
      });
      const ops = collectedOuterToInner.length > 0 ? collectedOuterToInner.reverse() : [];
      return {
        ok: true,
        confidence: ops.length > 0 ? 'partial' : 'selector-only',
        value: { metric: extracted.metric, labels: extracted.labels, operations: ops },
        warnings: warnings.length ? warnings : undefined,
      };
    }

    return { ok: false, error: '该 PromQL 暂无法反解析为 Builder 模式（best-effort 解析失败）' };
  }

  return { ok: false, error: 'PromQL 解析超过最大迭代次数限制' };
}

export const promqlParser = {
  parseToVisualQuery: parsePromqlToVisualQuery,
  emptyVisualQuery: buildEmptyQuery,
} as const;
