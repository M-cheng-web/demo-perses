import { parser as promqlLezerParser } from '@prometheus-io/lezer-promql';
import type { Tree } from '@lezer/common';
import type { TreeCursor } from '@lezer/common';

export type PromqlDiagnosticSeverity = 'error' | 'warning';

export interface PromqlRange {
  /** 起始位置（字符偏移，0-based） */
  from: number;
  /** 结束位置（字符偏移，0-based，开区间） */
  to: number;
}

export interface PromqlDiagnostic {
  severity: PromqlDiagnosticSeverity;
  message: string;
  /**
   * 错误范围（字符偏移，0-based）。
   *
   * 注意：
   * - 我们在语法解析前会对 Grafana 变量做“长度不变”的兜底替换（例如 `$__interval` -> `1111111111s`），
   *   这样 lezer 能按 PromQL 语法解析，同时 range 仍然能对齐到原始表达式的位置。
   */
  range?: PromqlRange;
}

export type PromqlAstParseResult =
  | { ok: true; ast: Tree; diagnostics: PromqlDiagnostic[] }
  | { ok: false; ast: Tree; diagnostics: PromqlDiagnostic[] };

/**
 * PromQL -> AST（lezer）解析
 *
 * 说明：
 * - lezer 会始终返回一棵 parse tree（即使有错误节点），因此我们额外扫描 Error 节点生成 diagnostics。
 * - 当前阶段只在“编辑器”内使用（Code <-> Builder 切换、校验、提示），不进入运行时查询执行链路。
 */
export function parsePromqlToAst(expr: string): PromqlAstParseResult {
  const raw = String(expr ?? '');
  const trimmed = raw.trim();

  // 说明：
  // - 在编辑器里，“空输入”更接近“尚未填写”，而不是“语法错误”
  // - 因此这里直接视为 ok，并且不返回 diagnostics（避免 UI 一打开就红）
  // - 仍然返回一棵 tree，保证调用方不需要做额外分支
  if (!trimmed) {
    return { ok: true, ast: promqlLezerParser.parse(''), diagnostics: [] };
  }

  // 说明：
  // - lezer-promql 是“标准 PromQL”语法；Grafana 的一些变量（例如 `$__interval`）不属于标准语法
  // - 但它们在编辑器场景非常常见，因此这里做一个“仅用于语法层兜底”的替换（长度保持不变）
  // - 替换只影响语法判定/diagnostics，不会改变上层真正执行/保存的 PromQL（上层仍使用原始 expr）
  const text = sanitizePromqlForLezer(raw);

  const ast = promqlLezerParser.parse(text);
  const diagnostics = collectLezerErrors(ast);
  const ok = diagnostics.every((d) => d.severity !== 'error');
  return ok ? { ok: true, ast, diagnostics } : { ok: false, ast, diagnostics };
}

/**
 * 从 lezer parse tree 中收集 Error 节点。
 *
 * 注意：
 * - lezer 的错误信息比较“结构化”但不包含人类友好的语法提示，我们这里先用通用 message 兜底。
 * - 后续可以按 node.type.name 做更精细的错误文案。
 */
function collectLezerErrors(tree: Tree): PromqlDiagnostic[] {
  const out: PromqlDiagnostic[] = [];
  const cursor = tree.cursor();
  do {
    // lezer 用 node.type.isError 标识错误节点
    if (cursor.type.isError) {
      out.push({
        severity: 'error',
        message: 'PromQL 语法错误（parser 发现无法解析的片段）',
        range: { from: cursor.from, to: cursor.to },
      });
    }
  } while (cursor.next());
  return mergeOverlappingDiagnostics(out);
}

/** 合并/去重重叠的错误范围，避免 UI 出现大量重复提示 */
function mergeOverlappingDiagnostics(list: PromqlDiagnostic[]): PromqlDiagnostic[] {
  if (list.length <= 1) return list;
  const withRange = list.filter((d) => d.range && typeof d.range.from === 'number' && typeof d.range.to === 'number') as Array<
    PromqlDiagnostic & { range: PromqlRange }
  >;
  const withoutRange = list.filter((d) => !d.range);

  const sorted = [...withRange].sort((a, b) => a.range.from - b.range.from || a.range.to - b.range.to);
  const out: PromqlDiagnostic[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(d);
      continue;
    }
    const lastRange = (last as any).range as PromqlRange | undefined;
    if (lastRange && d.range.from <= lastRange.to) {
      // 合并 range，message 先保留“更靠前”的即可
      (last as any).range = { from: lastRange.from, to: Math.max(lastRange.to, d.range.to) };
      continue;
    }
    out.push(d);
  }
  return [...out, ...withoutRange];
}

/**
 * 把 Grafana 扩展变量替换成“标准 PromQL”可接受的占位值，仅用于语法解析。
 *
 * 覆盖场景（常见）：
 * - `metric[$__interval]`
 * - `metric[$__range]`
 * - `offset $__interval`
 *
 * 说明：
 * - 此函数不追求完美，只做编辑器体验的“best-effort 语法兜底”。
 * - 我们会尽量保持替换前后字符串长度一致，以便 diagnostics 的 range 能对齐原表达式。
 */
function sanitizePromqlForLezer(expr: string): string {
  const s = String(expr ?? '');

  // 1) 替换方括号范围里的 Grafana 变量：[$__interval] / [$__range] / [${__interval}] / [[__interval]]
  //    注意：只处理“非字符串”部分（PromQL 字符串字面量内部不应替换）
  let out = '';
  let i = 0;
  let inString = false;
  while (i < s.length) {
    const ch = s[i]!;
    if (inString) {
      out += ch;
      if (ch === '\\') {
        // 跳过转义
        if (i + 1 < s.length) {
          out += s[i + 1]!;
          i += 2;
          continue;
        }
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '[') {
      const start = i;
      // 找到匹配的 ]（不处理嵌套）
      i++;
      let inner = '';
      while (i < s.length && s[i] !== ']') {
        inner += s[i]!;
        i++;
      }
      if (i < s.length && s[i] === ']') {
        // inner 中替换 $__xxx / ${__xxx} / [[__xxx]]
        // 关键：替换后的长度必须与原 token 一致，避免 diagnostics 的 range 失真
        const replacedInner = inner.replace(/\$__[\w]+|\$\{__[\w]+\}|\[\[__[\w]+\]\]/g, (m) => {
          return buildDurationLiteralWithSameLength(m.length);
        });
        out += '[' + replacedInner + ']';
        i++; // skip ]
        continue;
      }
      // 未闭合：按原样输出
      out += s.slice(start);
      break;
    }

    out += ch;
    i++;
  }

  // 2) offset 变量兜底：offset $__interval -> offset 111...s（长度保持不变）
  //    只要出现就替换（同样可能改变长度，因此 replaced 会标记）
  const out2 = out.replace(/\boffset\s+\$__[\w]+/g, (m) => {
    return m.replace(/\$__[\w]+/, (v) => buildDurationLiteralWithSameLength(v.length));
  });

  return out2;
}

/**
 * 生成一个“合法 PromQL duration”的占位值，并确保长度与原 token 完全一致。
 *
 * 规则：
 * - duration 形态可以是 `111s` / `123m` / `1h` 等
 * - 为了保证总长度一致：使用 (len-1) 个数字 + 1 个单位字符（默认 's'）
 *
 * 示例：
 * - `$__interval` 长度 11 -> `1111111111s`（10 个 '1' + 's'）
 */
function buildDurationLiteralWithSameLength(len: number): string {
  const L = Math.max(0, Math.floor(len));
  // 正常 duration 至少 2 个字符（数字+单位）；这里做一个极端兜底以保持长度不变
  if (L <= 1) return '1'.repeat(L);
  return `${'1'.repeat(L - 1)}s`;
}

/**
 * 调试辅助：把 AST 的节点树打印成可读文本。
 * - 仅供本仓库的测试脚本/排查使用
 * - 生产代码请勿依赖输出格式
 */
export function debugPrintTree(tree: Tree, source: string, maxDepth: number = 6): string {
  const cursor = tree.cursor();
  const lines: string[] = [];
  const stack: Array<{ depth: number; end: number }> = [];

  const indent = (n: number) => '  '.repeat(Math.max(0, n));

  const enter = (c: TreeCursor, depth: number) => {
    const snippet = source.slice(c.from, c.to).replace(/\s+/g, ' ').trim();
    const clipped = snippet.length > 80 ? `${snippet.slice(0, 79)}…` : snippet;
    lines.push(`${indent(depth)}- ${c.type.name} [${c.from},${c.to}] ${clipped ? `: ${clipped}` : ''}`);
  };

  // 游标初始在 root
  enter(cursor, 0);
  stack.push({ depth: 0, end: cursor.to });

  while (true) {
    const top = stack[stack.length - 1];
    if (!top) break;
    if (top.depth >= maxDepth) {
      // 深度限制：直接跳出当前子树
      while (cursor.nextSibling()) {
        // skip
      }
      if (!cursor.parent()) break;
      stack.pop();
      continue;
    }

    if (cursor.firstChild()) {
      const depth = top.depth + 1;
      enter(cursor, depth);
      stack.push({ depth, end: cursor.to });
      continue;
    }

    if (cursor.nextSibling()) {
      enter(cursor, top.depth + 1);
      continue;
    }

    if (!cursor.parent()) break;
    stack.pop();
  }

  return lines.join('\n');
}
