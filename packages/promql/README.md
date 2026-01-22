# @grafana-fast/promql

PromQL 解析与编辑器侧转换工具包（基于 `@prometheus-io/lezer-promql`），提供：

- PromQL -> AST（lezer `Tree`）
- 语法诊断（diagnostics，带 range）
- PromQL（Code） -> `PromVisualQuery`（Builder）转换（best-effort）
- 少量调试辅助（例如 AST 打印）

设计目标（偏编辑器场景）：

- **稳定**：即使有语法错误也能拿到一棵 parse tree + diagnostics
- **可解释**：转换不保证完全等价，会通过 warnings 提示未支持/已过滤的语义
- **可降级**：AST 映射覆盖不到的场景，会回退到字符串 best-effort 解析（保证可用）

兼容性说明：

- 默认会对常见 Grafana 变量做“长度保持不变”的占位替换（例如 `$__interval`），仅用于语法解析与 diagnostics 的 range 对齐
- 不会修改你真正执行/保存的 PromQL（上层仍应使用原始表达式）

## 安装

```bash
pnpm add @grafana-fast/promql
```

## API

### `parsePromqlToAst(expr: string)`

- 返回 `{ ok, ast, diagnostics }`
- `ok=false` 表示存在语法错误（但 `ast` 仍然可用）

### `parsePromqlToVisualQueryAst(expr: string)`

- PromQL（Code） -> `PromVisualQuery`（Builder）
- 返回 `confidence`（`exact` / `partial` / `selector-only`）与 `warnings`
- `ok=false` 通常表示 PromQL 语法错误或无法映射（建议回退到 Code 模式）

### `debugPrintTree(tree, source, maxDepth?)`

- 用于排查 AST 的辅助函数（输出格式不保证稳定）
