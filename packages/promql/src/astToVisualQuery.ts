import type { Tree, TreeCursor } from '@lezer/common';
import { aggById, aggWithoutId, promQueryModeller, type PromqlParseConfidence, type PromqlParseWarning } from '@grafana-fast/utils';
import type { PromVisualQuery, PromVisualQueryBinary, QueryBuilderLabelFilter, QueryBuilderOperation, VectorMatching } from '@grafana-fast/types';
import { PromOperationId } from '@grafana-fast/types';

/**
 * PromQL AST -> PromVisualQuery（QueryBuilder 映射层）
 *
 * 设计目标：
 * - 覆盖 QueryBuilder 当前能表达的 PromQL 子集
 * - 对无法表达/不支持的语义：尽量“向内提取”，并用 warnings 提示用户（best-effort）
 * - 上层应决定是否接受 partial（避免隐式改变语义）
 */

export interface AstToVisualQueryResult {
  ok: true;
  confidence: PromqlParseConfidence;
  value: PromVisualQuery;
  warnings?: PromqlParseWarning[];
}

export interface AstToVisualQueryFail {
  ok: false;
  error: string;
  warnings?: PromqlParseWarning[];
}

export type AstToVisualQueryAny = AstToVisualQueryResult | AstToVisualQueryFail;

type WarningContext = {
  warnings: PromqlParseWarning[];
  source: string;
};

/**
 * AST -> QueryBuilder 结构（PromVisualQuery）
 *
 * 注意：
 * - 这里的“成功”不等于“完全等价”，请结合返回的 `confidence` 与 `warnings` 决定是否接受转换
 */
export function astToVisualQuery(tree: Tree, source: string): AstToVisualQueryAny {
  const ctx: WarningContext = { warnings: [], source };
  const top = getTopExprCursor(tree);
  if (!top) return { ok: false, error: '未找到表达式节点' };

  const mapped = mapExprToVisualQuery(top, ctx);
  if (!mapped.ok) {
    return {
      ok: false,
      error: mapped.error,
      warnings: ctx.warnings.length ? ctx.warnings : undefined,
    };
  }

  // 说明：只要有 warning，就视为 partial（除非 selector-only）
  const hasWarnings = ctx.warnings.length > 0;
  const confidence: PromqlParseConfidence = mapped.selectorOnly ? 'selector-only' : hasWarnings ? 'partial' : 'exact';

  return {
    ok: true,
    confidence,
    value: mapped.query,
    warnings: ctx.warnings.length ? ctx.warnings : undefined,
  };
}

function getTopExprCursor(tree: Tree): TreeCursor | null {
  const c = tree.cursor();
  if (!c.firstChild()) return null;
  // root 下第一个非 error 的节点通常就是表达式
  do {
    if (!c.type.isError) return cloneCursor(c);
  } while (c.nextSibling());
  return null;
}

type MappedQuery = {
  ok: true;
  query: PromVisualQuery;
  /** 是否只做了 selector 提取（无法映射任何 wrapper） */
  selectorOnly: boolean;
};

type MappedFail = { ok: false; error: string };

/**
 * 把任意 PromQL 表达式映射为 PromVisualQuery（含 binaryQueries）。
 *
 * 关键约束（来自你们现有 QueryBuilder 模型）：
 * - operations 只能作用在“左侧基础查询”上（renderOperations 在 binaryQueries 之前执行）
 * - 因此：函数/聚合包裹整个 binary expr（例如 `acos(a + b)`）无法精确表达
 *   - 这里会给 warning，并“尽量向内提取”，让用户在 Builder 中至少看到可编辑的部分
 */
function mapExprToVisualQuery(expr: TreeCursor, ctx: WarningContext): MappedQuery | MappedFail {
  // 先做一层“剥壳”：
  // - 括号
  // - offset / @ modifier（目前 Builder 不支持，先过滤并告警）
  const current = stripUnsupportedWrappers(expr, ctx);

  // 处理 binary expr（可能生成 binaryQueries 或 scalar operation）
  if (current.type.name === 'BinaryExpr') {
    return mapBinaryExpr(current, ctx);
  }

  // 核心：外层 wrapper 迭代剥离（聚合/函数/标量二元）
  const operationsOuterToInner: QueryBuilderOperation[] = [];
  let inner = cloneCursor(current);

  for (let iter = 0; iter < 200; iter++) {
    inner = stripUnsupportedWrappers(inner, ctx);

    // 1) selector（终点）
    if (inner.type.name === 'VectorSelector') {
      const sel = parseVectorSelector(inner, ctx);
      if (!sel.ok) return { ok: false, error: '无法解析指标/标签' };
      const ops = operationsOuterToInner.reverse(); // inner -> outer
      return { ok: true, selectorOnly: ops.length === 0, query: { metric: sel.metric, labels: sel.labels, operations: ops } };
    }

    // 2) 聚合 wrapper
    if (inner.type.name === 'AggregateExpr') {
      const agg = parseAggregateExpr(inner, ctx);
      if (agg.ok) {
        // 如果聚合/函数包裹的是 BinaryExpr：无法精确表达（operations 不会包裹 binaryQueries）
        const innerStripped = stripUnsupportedWrappers(agg.inner, ctx);
        if (innerStripped.type.name === 'BinaryExpr') {
          warn(ctx, operationsOuterToInner, {
            code: 'UNSUPPORTED_FEATURE',
            message: `Builder 暂不支持“聚合包裹二元表达式”，已过滤外层聚合：${agg.op.id}`,
            snippet: snippetOf(ctx.source, inner.from, inner.to),
          });
          inner = agg.inner;
          continue;
        }
        operationsOuterToInner.push(agg.op);
        inner = agg.inner;
        continue;
      }
    }

    // 3) 函数 wrapper
    if (inner.type.name === 'FunctionCall') {
      const fn = parseFunctionCall(inner, ctx);
      if (fn.ok) {
        const innerStripped = stripUnsupportedWrappers(fn.inner, ctx);
        if (innerStripped.type.name === 'BinaryExpr') {
          warn(ctx, operationsOuterToInner, {
            code: 'UNSUPPORTED_FEATURE',
            message: `Builder 暂不支持“函数包裹二元表达式”，已过滤外层函数：${fn.op.id}`,
            snippet: snippetOf(ctx.source, inner.from, inner.to),
          });
          inner = fn.inner;
          continue;
        }
        operationsOuterToInner.push(fn.op);
        inner = fn.inner;
        continue;
      }

      if (fn.filteredAsUnknown && fn.inner) {
        warn(ctx, operationsOuterToInner, {
          code: 'UNKNOWN_WRAPPER',
          message: `未识别函数：${fn.name || 'unknown'}（已过滤）`,
          snippet: snippetOf(ctx.source, inner.from, inner.to),
        });
        inner = fn.inner;
        continue;
      }
    }

    // 4) 如果是 MatrixSelector / SubqueryExpr 直接出现在顶层：Builder 没有等价表达
    //    但我们至少提取 vector selector，让用户看到 metric/labels
    if (inner.type.name === 'MatrixSelector' || inner.type.name === 'SubqueryExpr') {
      const extracted = extractSelectorFromRangeLike(inner, ctx);
      if (extracted.ok) {
        warn(ctx, operationsOuterToInner, {
          code: 'UNSUPPORTED_FEATURE',
          message: `Builder 暂不支持“矩阵/子查询表达式”作为基础查询，已仅提取 selector`,
          snippet: snippetOf(ctx.source, inner.from, inner.to),
        });
        const ops = operationsOuterToInner.reverse();
        return { ok: true, selectorOnly: ops.length === 0, query: { metric: extracted.metric, labels: extracted.labels, operations: ops } };
      }
    }

    // 5) 无法继续：兜底提取 selector
    const extracted = extractFirstVectorSelector(inner, ctx);
    if (extracted.ok) {
      warn(ctx, operationsOuterToInner, {
        code: 'UNPARSED_EXPRESSION',
        message: `未完全反解析（已提取 ${extracted.metric}）`,
        snippet: snippetOf(ctx.source, inner.from, inner.to),
      });
      const ops = operationsOuterToInner.reverse();
      return { ok: true, selectorOnly: true, query: { metric: extracted.metric, labels: extracted.labels, operations: ops } };
    }

    return { ok: false, error: '该表达式暂无法映射为 Builder（AST mapping 子集）' };
  }

  return { ok: false, error: '解析超过最大迭代次数限制' };
}

function stripUnsupportedWrappers(expr: TreeCursor, ctx: WarningContext): TreeCursor {
  let current = cloneCursor(expr);
  for (let i = 0; i < 50; i++) {
    if (current.type.name === 'ParenExpr') {
      const inner = firstChildExpr(current);
      if (inner) {
        current = inner;
        continue;
      }
    }

    if (current.type.name === 'OffsetExpr') {
      const inner = firstChildExpr(current);
      if (inner) {
        warn(ctx, [], {
          code: 'UNSUPPORTED_FEATURE',
          message: 'Builder 暂不支持 offset 修饰符（已过滤）',
          snippet: snippetOf(ctx.source, current.from, current.to),
        });
        current = inner;
        continue;
      }
    }

    if (current.type.name === 'StepInvariantExpr') {
      const inner = firstChildExpr(current);
      if (inner) {
        warn(ctx, [], {
          code: 'UNSUPPORTED_FEATURE',
          message: 'Builder 暂不支持 @ 修饰符（step invariant，已过滤）',
          snippet: snippetOf(ctx.source, current.from, current.to),
        });
        current = inner;
        continue;
      }
    }

    break;
  }
  return current;
}

function mapBinaryExpr(expr: TreeCursor, ctx: WarningContext): MappedQuery | MappedFail {
  const parts = getBinaryExprParts(expr, ctx);
  if (!parts.ok) return { ok: false, error: '无法解析二元表达式结构' };

  const scalar = parseBinaryScalar(parts, ctx);
  if (scalar.ok) {
    const op = scalar.op;
    const innerExpr = scalar.inner;
    const innerQuery = mapExprToVisualQuery(innerExpr, ctx);
    if (!innerQuery.ok) return innerQuery;

    if (innerQuery.query.binaryQueries && innerQuery.query.binaryQueries.length > 0) {
      warn(ctx, [], {
        code: 'UNSUPPORTED_FEATURE',
        message: `Builder 暂不支持“标量二元操作包裹 binaryQueries”，已过滤外层标量操作：${op.id}`,
        snippet: snippetOf(ctx.source, expr.from, expr.to),
      });
      return innerQuery;
    }

    innerQuery.query.operations = [...(innerQuery.query.operations ?? []), op];
    return { ok: true, selectorOnly: innerQuery.selectorOnly, query: innerQuery.query };
  }

  const operator = parts.operatorText;
  const allowed = new Set(['+', '-', '*', '/', '%', '^', '==', '!=', '>', '<', '>=', '<=']);
  if (!allowed.has(operator)) {
    warn(ctx, [], {
      code: 'UNSUPPORTED_FEATURE',
      message: `Builder 暂不支持该二元运算符：${operator}`,
      snippet: snippetOf(ctx.source, expr.from, expr.to),
    });
    const fallback = extractFirstVectorSelector(expr, ctx);
    if (fallback.ok) return { ok: true, selectorOnly: true, query: { metric: fallback.metric, labels: fallback.labels, operations: [] } };
    return { ok: false, error: '该二元表达式暂无法映射为 Builder' };
  }

  const left = mapExprToVisualQuery(parts.left, ctx);
  const right = mapExprToVisualQuery(parts.right, ctx);
  if (!left.ok) return left;
  if (!right.ok) return right;

  const vectorMatching = parts.matching ? parseVectorMatching(parts.matching, ctx) : undefined;
  const bin: PromVisualQueryBinary = {
    operator,
    vectorMatching: vectorMatching ?? undefined,
    query: right.query,
  };

  const out: PromVisualQuery = {
    ...left.query,
    binaryQueries: [...(left.query.binaryQueries ?? []), bin],
  };

  return { ok: true, selectorOnly: false, query: out };
}

type BinaryExprParts =
  | { ok: true; left: TreeCursor; right: TreeCursor; operatorText: string; boolModifier?: TreeCursor; matching?: TreeCursor }
  | { ok: false };

function getBinaryExprParts(expr: TreeCursor, ctx: WarningContext): BinaryExprParts {
  const children = getChildren(expr);
  const exprChildren = children.filter((c) => isExprNode(c.type.name));
  if (exprChildren.length < 2) return { ok: false };

  const left = exprChildren[0]!;
  const right = exprChildren[exprChildren.length - 1]!;
  const opToken = children.find((c) => isBinaryOperatorToken(c.type.name));
  if (!opToken) return { ok: false };

  const boolModifierNode = children.find((c) => c.type.name === 'BoolModifier');
  const matchingNode = children.find((c) => c.type.name === 'MatchingModifierClause');
  const operatorText = ctx.source.slice(opToken.from, opToken.to).trim();

  return {
    ok: true,
    left,
    right,
    operatorText,
    boolModifier: boolModifierNode ? cloneCursor(boolModifierNode) : undefined,
    matching: matchingNode ? cloneCursor(matchingNode) : undefined,
  };
}

type BinaryScalarResult = { ok: true; op: QueryBuilderOperation; inner: TreeCursor } | { ok: false };

function parseBinaryScalar(parts: BinaryExprParts, ctx: WarningContext): BinaryScalarResult {
  if (!parts.ok) return { ok: false };
  if (parts.matching) return { ok: false };

  const leftIsNumber = isNumberLiteral(parts.left.type.name);
  const rightIsNumber = isNumberLiteral(parts.right.type.name);
  const hasBool = Boolean(parts.boolModifier);
  const operator = parts.operatorText;

  const map: Record<string, PromOperationId | undefined> = {
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

  const opId = map[operator];
  if (!opId) return { ok: false };

  // 形态：expr + 4 / expr > 4 bool
  if (!leftIsNumber && rightIsNumber) {
    const num = Number(ctx.source.slice(parts.right.from, parts.right.to).trim());
    if (!Number.isFinite(num)) return { ok: false };
    const isComparison = ['==', '!=', '>', '<', '>=', '<='].includes(operator);
    const params = isComparison ? [num, hasBool] : [num];
    return { ok: true, op: { id: opId, params }, inner: cloneCursor(parts.left) };
  }

  // 形态：4 + expr（只对 +、* 做交换）
  if (leftIsNumber && !rightIsNumber && (operator === '+' || operator === '*')) {
    const num = Number(ctx.source.slice(parts.left.from, parts.left.to).trim());
    if (!Number.isFinite(num)) return { ok: false };
    const params = [num];
    const swappedOpId = operator === '+' ? PromOperationId.Addition : PromOperationId.MultiplyBy;
    return { ok: true, op: { id: swappedOpId, params }, inner: cloneCursor(parts.right) };
  }

  return { ok: false };
}

function parseVectorMatching(matching: TreeCursor, ctx: WarningContext): VectorMatching | null {
  const children = getChildren(matching);

  const typeNodeRaw = children.find((c) => c.type.name === 'On' || c.type.name === 'Ignoring');
  const labelsNodeRaw = children.find((c) => c.type.name === 'GroupingLabels');
  const typeNode = typeNodeRaw ? cloneCursor(typeNodeRaw) : undefined;
  const labelsNode = labelsNodeRaw ? cloneCursor(labelsNodeRaw) : undefined;

  // 说明：当前模型未支持 group_left/group_right，这里先告警并忽略
  if (children.some((c) => c.type.name === 'GroupLeft' || c.type.name === 'GroupRight')) {
    warn(ctx, [], {
      code: 'UNSUPPORTED_FEATURE',
      message: 'Builder 暂不支持 group_left/group_right（已忽略）',
      snippet: snippetOf(ctx.source, matching.from, matching.to),
    });
  }

  if (!typeNode || !labelsNode) return null;
  const typeText = ctx.source.slice(typeNode.from, typeNode.to).trim();
  const type: VectorMatching['type'] | null = typeText === 'on' ? 'on' : typeText === 'ignoring' ? 'ignoring' : null;
  if (!type) return null;

  const labels = getChildren(labelsNode)
    .filter((c) => c.type.name === 'LabelName')
    .map((c) => ctx.source.slice(c.from, c.to).trim())
    .filter((v) => v.length > 0);
  if (labels.length === 0) return null;

  return { type, labels };
}

function parseAggregateExpr(agg: TreeCursor, ctx: WarningContext): { ok: true; op: QueryBuilderOperation; inner: TreeCursor } | { ok: false } {
  const opNodeRaw = getChildren(agg).find((c) => c.type.name === 'AggregateOp');
  const opNode = opNodeRaw ? cloneCursor(opNodeRaw) : undefined;
  if (!opNode) return { ok: false };

  const name = ctx.source.slice(opNode.from, opNode.to).trim();
  const opDef = promQueryModeller.getOperationDef(name);
  if (!opDef || opDef.category !== 'Aggregations') return { ok: false };

  const modifierRaw = getChildren(agg).find((c) => c.type.name === 'AggregateModifier');
  const bodyRaw = getChildren(agg).find((c) => c.type.name === 'FunctionCallBody');
  const modifier = modifierRaw ? cloneCursor(modifierRaw) : undefined;
  const body = bodyRaw ? cloneCursor(bodyRaw) : undefined;
  if (!body) return { ok: false };

  const args = getBodyArgs(body);
  if (args.length === 0) return { ok: false };

  const inner = cloneCursor(args[args.length - 1]!);
  const paramNodes = args.slice(0, -1);
  const defParams = opDef.params ?? [];

  const restIndex = defParams.findIndex((p) => p.restParam);
  const fixedDefs = restIndex >= 0 ? defParams.slice(0, restIndex) : defParams;

  const parsedParams: Array<string | number | boolean> = [];
  for (let i = 0; i < Math.min(paramNodes.length, fixedDefs.length); i++) {
    const val = parseParamNode(paramNodes[i]!, fixedDefs[i]!, ctx);
    if (val.ok) parsedParams.push(val.value);
  }

  let opId = name;
  const groupLabels: string[] = [];
  if (modifier) {
    const by = getChildren(modifier).some((c) => c.type.name === 'By');
    const without = getChildren(modifier).some((c) => c.type.name === 'Without');
    const labelsNodeRaw = getChildren(modifier).find((c) => c.type.name === 'GroupingLabels');
    const labelsNode = labelsNodeRaw ? cloneCursor(labelsNodeRaw) : undefined;

    if (labelsNode) {
      for (const l of getChildren(labelsNode)) {
        if (l.type.name !== 'LabelName') continue;
        const v = ctx.source.slice(l.from, l.to).trim();
        if (v) groupLabels.push(v);
      }
    }

    if (by) opId = aggById(name);
    else if (without) opId = aggWithoutId(name);
  }

  const params = [...parsedParams, ...groupLabels];
  return { ok: true, op: { id: opId, params }, inner };
}

function parseFunctionCall(
  call: TreeCursor,
  ctx: WarningContext
): { ok: true; op: QueryBuilderOperation; inner: TreeCursor } | { ok: false; filteredAsUnknown?: boolean; inner?: TreeCursor; name?: string } {
  const nameNodeRaw = getChildren(call).find((c) => c.type.name === 'FunctionIdentifier');
  const bodyRaw = getChildren(call).find((c) => c.type.name === 'FunctionCallBody');
  const nameNode = nameNodeRaw ? cloneCursor(nameNodeRaw) : undefined;
  const body = bodyRaw ? cloneCursor(bodyRaw) : undefined;
  if (!nameNode || !body) return { ok: false };

  const name = ctx.source.slice(nameNode.from, nameNode.to).trim();
  const args = getBodyArgs(body);
  if (args.length === 0) return { ok: false };

  const opDef = promQueryModeller.getOperationDef(name);
  if (!opDef) {
    // 说明：未知函数 —— 如果只有一个参数，按“可剥离 wrapper”处理
    if (args.length === 1) return { ok: false, filteredAsUnknown: true, inner: cloneCursor(args[0]!), name };
    return { ok: false };
  }

  const paramDefs = opDef.params ?? [];
  const hasRangeParam = paramDefs[0]?.name === 'Range';
  if (hasRangeParam) {
    // range 函数：优先从 MatrixSelector/SubqueryExpr 中提取 range
    const rangeLikeRaw = args.find((a) => a.type.name === 'MatrixSelector' || a.type.name === 'SubqueryExpr');
    const rangeLike = rangeLikeRaw ? cloneCursor(rangeLikeRaw) : undefined;
    if (!rangeLike) return { ok: false };

    const extracted = extractRangeLike(rangeLike, ctx);
    if (!extracted.ok) return { ok: false };

    const otherArgs = args.filter((a) => a !== rangeLike);
    const otherDefs = paramDefs.slice(1);

    const parsedParams: Array<string | number | boolean> = [extracted.range];
    for (let i = 0; i < Math.min(otherArgs.length, otherDefs.length); i++) {
      const v = parseParamNode(otherArgs[i]!, otherDefs[i]!, ctx);
      if (v.ok) parsedParams.push(v.value);
    }

    return { ok: true, op: { id: name, params: parsedParams }, inner: extracted.inner };
  }

  // 说明：部分函数（例如 label_join/label_replace）把“表达式参数”放在第一个
  const preferInnerFirst = name === 'label_join' || name === 'label_replace';
  const innerIndex = preferInnerFirst ? 0 : args.length - 1;
  const inner = cloneCursor(args[innerIndex]!);
  const paramNodes = args.filter((_, i) => i !== innerIndex);

  const defParams = opDef.params ?? [];
  const restIndex = defParams.findIndex((p) => p.restParam);
  const fixedDefs = restIndex >= 0 ? defParams.slice(0, restIndex) : defParams;

  const parsedParams: Array<string | number | boolean> = [];
  for (let i = 0; i < Math.min(paramNodes.length, fixedDefs.length); i++) {
    const v = parseParamNode(paramNodes[i]!, fixedDefs[i]!, ctx);
    if (v.ok) parsedParams.push(v.value);
  }

  return { ok: true, op: { id: name, params: parsedParams }, inner };
}

function extractRangeLike(node: TreeCursor, ctx: WarningContext): { ok: true; inner: TreeCursor; range: string } | { ok: false } {
  if (node.type.name === 'MatrixSelector') {
    // 形态：metric[5m]
    const children = getChildren(node);
    const vector = children.find((c) => c.type.name === 'VectorSelector');
    const rangeNode = children.find((c) => c.type.name === 'NumberDurationLiteralInDurationContext');
    if (!vector || !rangeNode) return { ok: false };
    const range = ctx.source.slice(rangeNode.from, rangeNode.to).trim();
    return { ok: true, inner: cloneCursor(vector), range };
  }

  if (node.type.name === 'SubqueryExpr') {
    // 形态：expr[5m:1m]（step 暂不支持）
    const children = getChildren(node);
    const vector = children.find((c) => isExprNode(c.type.name));
    const rangeNode = children.find((c) => c.type.name === 'NumberDurationLiteralInDurationContext');
    if (!vector || !rangeNode) return { ok: false };

    const range = ctx.source.slice(rangeNode.from, rangeNode.to).trim();

    // 是否存在 step（第二个 duration）
    const durations = children.filter((c) => c.type.name === 'NumberDurationLiteralInDurationContext');
    if (durations.length >= 2) {
      warn(ctx, [], {
        code: 'UNSUPPORTED_FEATURE',
        message: 'Builder 暂不支持 Subquery step（已忽略）',
        snippet: snippetOf(ctx.source, node.from, node.to),
      });
    }

    return { ok: true, inner: cloneCursor(vector), range };
  }

  return { ok: false };
}

function extractSelectorFromRangeLike(
  node: TreeCursor,
  ctx: WarningContext
): { ok: true; metric: string; labels: QueryBuilderLabelFilter[] } | { ok: false } {
  const extracted = extractRangeLike(node, ctx);
  if (!extracted.ok) return { ok: false };
  const sel =
    extracted.inner.type.name === 'VectorSelector' ? parseVectorSelector(extracted.inner, ctx) : extractFirstVectorSelector(extracted.inner, ctx);
  if (!sel.ok) return { ok: false };
  return { ok: true, metric: sel.metric, labels: sel.labels };
}

function parseVectorSelector(
  vector: TreeCursor,
  ctx: WarningContext
): { ok: true; metric: string; labels: QueryBuilderLabelFilter[] } | { ok: false } {
  const children = getChildren(vector);
  const idRaw = children.find((c) => c.type.name === 'Identifier');
  const id = idRaw ? cloneCursor(idRaw) : undefined;
  if (!id) return { ok: false };

  const metric = ctx.source.slice(id.from, id.to).trim();
  const matcherRaw = children.find((c) => c.type.name === 'LabelMatchers');
  const matcherNode = matcherRaw ? cloneCursor(matcherRaw) : undefined;
  if (!matcherNode) return { ok: true, metric, labels: [] };

  const labels: QueryBuilderLabelFilter[] = [];
  for (const m of getChildren(matcherNode)) {
    if (m.type.name !== 'UnquotedLabelMatcher') continue;
    const mm = parseLabelMatcher(m, ctx);
    if (mm.ok) labels.push(mm.value);
  }

  return { ok: true, metric, labels };
}

function parseLabelMatcher(matcher: TreeCursor, ctx: WarningContext): { ok: true; value: QueryBuilderLabelFilter } | { ok: false } {
  const children = getChildren(matcher);
  const nameRaw = children.find((c) => c.type.name === 'LabelName');
  const opRaw = children.find((c) => c.type.name === 'MatchOp');
  const valRaw = children.find((c) => c.type.name === 'StringLiteral');
  const name = nameRaw ? cloneCursor(nameRaw) : undefined;
  const op = opRaw ? cloneCursor(opRaw) : undefined;
  const val = valRaw ? cloneCursor(valRaw) : undefined;
  if (!name || !op || !val) return { ok: false };

  const label = ctx.source.slice(name.from, name.to).trim();
  const opText = ctx.source.slice(op.from, op.to).trim();
  const valueRaw = ctx.source.slice(val.from, val.to);
  const value = parsePromqlStringLiteral(valueRaw);
  if (label.length === 0 || value == null) return { ok: false };
  return { ok: true, value: { label, op: opText, value } };
}

function parseParamNode(
  node: TreeCursor,
  def: { type?: string } | undefined,
  ctx: WarningContext
): { ok: true; value: string | number | boolean } | { ok: false } {
  const raw = ctx.source.slice(node.from, node.to).trim();

  if (def?.type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false };
    return { ok: true, value: n };
  }

  if (def?.type === 'boolean') {
    if (raw === 'true') return { ok: true, value: true };
    if (raw === 'false') return { ok: true, value: false };
    return { ok: false };
  }

  const s = parsePromqlStringLiteral(raw);
  if (s != null) return { ok: true, value: s };
  return { ok: true, value: raw };
}

function parsePromqlStringLiteral(text: string): string | null {
  const s = String(text ?? '').trim();
  if (!s.startsWith('"') || !s.endsWith('"') || s.length < 2) return null;
  const inner = s.slice(1, -1);
  return inner.replace(/\\\\|\\n|\\t|\\r|\\"/g, (m) => {
    if (m === '\\\\') return '\\';
    if (m === '\\"') return '"';
    if (m === '\\n') return '\n';
    if (m === '\\t') return '\t';
    if (m === '\\r') return '\r';
    return m;
  });
}

function getBodyArgs(body: TreeCursor): TreeCursor[] {
  const children = getChildren(body);
  return children.filter((c) => {
    if (c.type.isError) return false;
    const name = c.type.name;
    if (!name) return false;
    if (name === 'FunctionCallBody') return false;
    return isExprNode(name) || isLiteralNode(name) || name === 'LabelMatchers' || name === 'GroupingLabels';
  });
}

function firstChildExpr(node: TreeCursor): TreeCursor | null {
  const children = getChildren(node);
  const found = children.find((c) => isExprNode(c.type.name));
  return found ? cloneCursor(found) : null;
}

function extractFirstVectorSelector(
  node: TreeCursor,
  ctx: WarningContext
): { ok: true; metric: string; labels: QueryBuilderLabelFilter[] } | { ok: false } {
  const root = cloneCursor(node);
  const stack: TreeCursor[] = [root];

  while (stack.length) {
    const c = stack.pop()!;
    if (c.type.name === 'VectorSelector') {
      const sel = parseVectorSelector(c, ctx);
      if (sel.ok) return sel;
    }
    const children = getChildren(c);
    for (let i = children.length - 1; i >= 0; i--) stack.push(cloneCursor(children[i]!));
  }

  return { ok: false };
}

function isExprNode(name: string) {
  return (
    name === 'VectorSelector' ||
    name === 'MatrixSelector' ||
    name === 'SubqueryExpr' ||
    name === 'FunctionCall' ||
    name === 'AggregateExpr' ||
    name === 'BinaryExpr' ||
    name === 'ParenExpr' ||
    name === 'OffsetExpr' ||
    name === 'StepInvariantExpr'
  );
}

function isLiteralNode(name: string) {
  return name === 'StringLiteral' || name === 'NumberDurationLiteral' || name === 'NumberDurationLiteralInDurationContext';
}

function isNumberLiteral(name: string) {
  return name === 'NumberDurationLiteral';
}

function isBinaryOperatorToken(name: string) {
  return (
    name === 'Add' ||
    name === 'Sub' ||
    name === 'Mul' ||
    name === 'Div' ||
    name === 'Mod' ||
    name === 'Pow' ||
    name === 'Eql' ||
    name === 'Neq' ||
    name === 'Gtr' ||
    name === 'Lss' ||
    name === 'Gte' ||
    name === 'Lte'
  );
}

function getChildren(node: TreeCursor): TreeCursor[] {
  const c = cloneCursor(node);
  if (!c.firstChild()) return [];
  const out: TreeCursor[] = [];
  do out.push(cloneCursor(c));
  while (c.nextSibling());
  c.parent();
  return out;
}

function cloneCursor(cursor: TreeCursor): TreeCursor {
  // 注意：TreeCursor 没有 copy()，这里用 node.cursor() 克隆到相同位置
  return cursor.node.cursor();
}

function warn(ctx: WarningContext, opsOuterToInner: QueryBuilderOperation[], w: Omit<PromqlParseWarning, 'path'>) {
  const path = opsOuterToInner.map((op) => promQueryModeller.getOperationDef(op.id)?.name || op.id).filter((v) => String(v).trim().length > 0);
  ctx.warnings.push({ ...w, path: path.length ? path : undefined });
}

function snippetOf(source: string, from: number, to: number, maxLen: number = 120): string {
  const s = source.slice(Math.max(0, from), Math.min(source.length, to)).replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
