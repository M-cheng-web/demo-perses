# DataQueryTab 模块评估与优化建议（全局视角）

本文档聚焦 `packages/dashboard/src/components/PanelEditor/DataQueryTab.vue` 这一块“面板编辑器-数据查询”模块，包含：

- 现状（已实现/已修复点）与历史问题复盘
- 当前实现的结构、数据流、关键约束
- 仍然存在的风险/技术债
- 建议的优化方向、可维护性改造方案
- 可落地的验收清单（不做 P0/P1 区分，按主题分组）

目标定位：先把 Grafana 的“核心查询编辑体验”做扎实（可用、稳定、可维护），再在多个领域超越它。

---

## 1. 模块边界与职责

### 1.1 DataQueryTab 负责什么

DataQueryTab 目前承担了“面板查询配置”的核心交互闭环：

- 支持两种编辑模式：`QueryBuilder`（可视化）与 `Code`（PromQL 文本）
- 支持多条 query（A/B/C...），包括折叠/隐藏/删除/新增
- 支持手动触发执行（“执行查询”按钮），而不是自动监听每次字段变化就请求
- 在父组件 `PanelEditorDrawer` 保存/执行时，提供：
  - `validateAndGetQueriesForSave()`
  - `validateAndGetQueriesForExecute()`

### 1.2 当前模块的“外部契约”

关键契约在 `packages/dashboard/src/components/PanelEditor/PanelEditorDrawer.vue`：

- **执行查询**：调用 `DataQueryTab.validateAndGetQueriesForExecute()`；若校验失败，不执行；成功则把 queries 回填到 `formData.queries` 并触发 `PanelPreview.executeQueries()`。
- **保存**：调用 `DataQueryTab.validateAndGetQueriesForSave()`；若校验失败，则保存失败且仍停留在抽屉内；成功则把 queries 回填到 `formData.queries`，再更新 dashboard store。

这个契约的价值：解决“用户没点执行查询就保存导致编辑丢失”的问题，同时也保证你要求的产品策略：

- **不自动执行**（避免监听每个字段变化导致重请求）
- **保存前强制校验并同步**（保证保存不会丢）

---

## 2. 历史问题复盘（为什么必须重构）

从 git 历史（早期版本）能看到这类设计风险：

- Builder 模式和 Code 模式维护两套状态（`builderQueryPanels` / `codeQueryPanels` + `codePromQLs` 等），模式切换后数据天然不一致。
- 初始化逻辑依赖 `isInitialized`，会忽略后续 `props.queries` 的变化（典型场景：抽屉打开后再赋值）。
- refId 基于数组长度生成，删除中间项后再新增会重复（例如 A/C，然后新增又变 C）。
- Builder 无法编辑已有 PromQL（没有“PromQL -> VisualQuery”的反解析能力）。
- 执行/保存的边界不清晰：只在执行时 emit 更新，导致“保存没执行 => 保存的不是最新编辑”。

这些不是“修修补补能解决”的问题，本质是模块的**数据模型与同步策略**需要统一。

---

## 3. 当前实现（已落地的方案说明）

### 3.1 统一的数据模型：QueryDraft

DataQueryTab 现在用 `queryDrafts` 统一承载所有状态（UI + builder + code）：

- 每条 query 都是一个 draft（含 `id/refId/hide/collapsed`）
- Code 数据：
  - `draft.code.expr`
  - `draft.code.legendFormat`
  - `draft.code.minStep`
- Builder 数据：
  - `draft.builder.status = 'ok' | 'unsupported'`
  - `draft.builder.visualQuery`
  - `draft.builder.parseWarnings`（best-effort 反解析提示）

优势：

- 模式切换只是在“同一份 draft 上的两种视图”之间同步，不会出现两套数据越来越不一致。
- 保存/执行只需要从 draft 生成 canonical queries，一条路径完成。

### 3.2 `props.queries` 的同步与避免回写循环

使用 `signatureFromCanonical()` 做签名（JSON stringify）：

- watch `props.queries`：如果发现是自己 emit 回来的签名，则跳过 reset，避免循环。
- watch `sessionKey`：父级变更 sessionKey 时强制 reset（解决 “打开抽屉后再赋值/切换面板” 场景）。

这一段解决了你点名的 “初始化忽略 props.queries 更新” 的高频 bug。

### 3.3 保存/执行的校验策略（符合你的产品决策）

- `validateDrafts('execute')`：只校验未隐藏 query（隐藏的 query 不阻塞执行）。
- `validateDrafts('save')`：校验所有 query（避免保存出一个空 expr 的面板配置）。

然后 `PanelEditorDrawer` 保存/执行分别调用对应的 expose 方法，保证一致性。

### 3.4 refId 生成策略（避免重复）

通过 `nextRefId(used)` 生成第一个未占用的 `A..Z..AA..`：

- 删除中间 query 后新增，会复用空缺，不会重复。
- 同时 `normalizeDrafts()` 在 reset 时也会确保 refId 唯一。

### 3.5 best-effort PromQL 反解析（Code -> Builder）

对应文件：`packages/utils/src/promql/parsePromqlToVisualQuery.ts`

能力范围（当前）：

- selector：`metric` / `metric{labels...}`
- 聚合 `by/without`：`sum by(job)(expr)`
- 函数 wrapper（已知 functions）：`acos(inner)`、`histogram_quantile(0.9, inner)` 等
- 范围向量：`rate(inner[5m])`，支持 `$__interval` 这类字符串
- 二元标量：`expr + 4`（映射为 operation id）
- 对未知 wrapper 或无法解析的片段：过滤并以 `warnings` 返回（confidence: `partial`/`selector-only`）

DataQueryTab 在 Builder 底部展示 warnings：

- 文案是中文为主，允许出现 warning/best-effort 等技术词
- 对未识别片段提示“已过滤”

这一步是你要求的“专门在一个文件内处理 code 反解析”的落地版本。

---

## 4. 现状优点（为什么这套实现值得保留）

1. **产品策略清晰**：执行查询是显式动作，保存前校验并同步，符合“不要监听每个字段变化自动请求”的设计。

2. **数据流闭环**：Draft -> CanonicalQuery 的转换路径明确；父组件保存/执行不再依赖“有没有点执行”。

3. **可扩展性比旧版强**：只要继续增强 `parsePromqlToVisualQuery()`，Builder 能逐步覆盖更多 PromQL 形态。

4. **用户可理解的失败形态**：不支持反解析时，Builder 会展示 warning/unsupported 提示，并引导去 Code 模式编辑。

---

## 5. 风险与技术债（全局角度必须知道的坑）

### 5.1 best-effort 反解析的语义风险

当 `confidence=partial` 时，Builder 渲染出来的 PromQL **可能不等价**于用户原始 Code PromQL（因为未知 wrapper/片段被过滤了）。

现在的策略是：

- 仍允许进入 Builder 并编辑（Builder.status = ok），并展示 warning
- 如果用户在 Builder 模式保存/执行，会使用 `renderPromql(visualQuery)` 的结果

这在“用户主动选择 Builder 并继续编辑”的语义上是合理的，但需要你在产品上明确：

- warning 不仅仅是提示，它意味着“表达式可能已被简化/改变”

建议（可选的更稳妥策略）：

- 当 `confidence !== 'exact'` 时，把 Builder 变成“只读预览（不可编辑）”，直到用户明确点击“接受转换（将丢失未识别片段）”。

### 5.2 深度 watch + JSON stringify 的性能边界

`signatureFromCanonical()` 使用 `JSON.stringify`，对 query 数量多、visualQuery 深、频繁变更时可能有性能成本。

在当前阶段 query 通常不多（1~5 条）可以接受，但如果未来支持：

- 多 panel 批量编辑
- 单 panel 内几十条 query
- visualQuery 结构更复杂（binaryQueries/复杂 params）

建议逐步演进：

- 用更轻量的签名（例如只 hash `id/refId/expr` + visualQuery 的 version）
- 或者由父组件传入 `queriesVersion`（每次外部更新 +1），避免 deep watch 大对象

### 5.3 类型边界仍偏 `any`

目前多个地方仍用 `any`（datasource/currentQuery/fix 等），长期会拖累可维护性：

- IDE 无法辅助发现错误
- 操作/参数的 editor 类型难以约束

建议：至少把 datasource 的最小接口定义出来（例如 `uid/type/name` + `getLabelKeys/getLabelValues` 等）。

### 5.4 QueryBuilder 的操作体系与 Grafana 的差距

QueryBuilder 的 “operation definitions（opDef）” 是核心资产：

- params schema
- addOperationHandler / paramChangedHandler
- explainHandler / documentation

当前你们已经对齐了 Grafana 的很多行为，但仍需持续验证：

- restParam（labels）在空/清空/删除时的联动是否一致
- 函数参数顺序（innerExpr 在 first/last）是否都覆盖

这块建议用“黑盒测试 + 快速 fixtures”持续补齐，而不是靠手工点 UI。

---

## 6. 建议的优化方向（不分优先级，按主题列）

### 6.1 结构与可维护性：把 DataQueryTab 拆成 4 个 composable

建议拆分（不要求一次做完，但方向明确）：

- `useQueryDrafts()`
  - resetFromProps / normalizeDrafts / refId 生成 / add/remove/hide/collapse
- `useQueryModeSync()`
  - builder->code、code->builder 的同步策略与状态机
- `useQueryValidation()`
  - validateDrafts('save'|'execute') + 错误定位策略（展开错误项）
- `useQueryEmit()`
  - debounce emit update:queries + signature guard（避免循环）

好处：

- DataQueryTab 组件本身只做 UI 拼装，逻辑更清晰
- 未来要做“Query 行为埋点/undo-redo/草稿缓存”更容易

### 6.2 反解析器：从“能用”走向“可靠可扩展”

当前 `parsePromqlToVisualQuery()` 是手写解析（best-effort），建议长期路线：

1. 保持 best-effort 作为 fallback（对未知表达式能给出 selector-only + warnings）
2. 引入 PromQL AST 解析器（如果未来允许依赖），把解析分两层：
   - AST parse（严格语法）
   - AST -> VisualQuery 的 mapping（只支持你们 QueryBuilder 能表达的子集）

短期可增强点（都能在现有手写解析里做）：

- `offset`、`@ start()` 这类语法（至少能识别并给 warning）
- binary vector matching（`on()/ignoring()/group_left/right`）：先识别为 warning，不要 silent 过滤
- subquery：`expr[5m:1m]`（先识别为 unsupported/warning）

### 6.3 UX：对“不可逆切换”给更明确的产品提示

你现在的产品决策是：**操作一旦选定就不能切换，只能删除重建**。

建议补齐的 UX：

- 在操作卡片标题旁加一条短提示：`已锁定（如需更换请删除重建）`
- 删除时可以保留一个“最近使用操作”列表，减少重建成本

### 6.4 公共组件：Select 的 slot/variant 能力要建立使用规范

你已经新增：

- `variant="text"`：无边框展示
- `#value` slot：自定义已选值展示
- `dropdownMaxHeight`：下拉默认高度且可配置

建议在组件库内部补一份“推荐用法示例”（可以放在 Storybook 或 docs，哪怕是简单 markdown）。

示例（只说明意图，不要求完全一致）：

- toolbar 场景：`<Select variant="text">` + `#value` 只展示 label，避免像输入框
- 表单场景：保留默认边框风格
- 对 QueryBuilder 的 label dropdown：关闭 `showSearch`，并设置合理 `dropdownMaxHeight`

---

## 7. 验收清单（建议你用它当回归 checklist）

### 7.1 保存/执行一致性

- 在 Code 模式编辑 expr，不点“执行查询”，直接点“保存”，保存内容不丢失
- 保存失败时（空 expr），抽屉不关闭，且能定位到具体 query（refId）
- 执行查询时：隐藏 query 不阻塞执行；保存时：隐藏 query 也要校验（按当前策略）

### 7.2 props 同步（抽屉打开后再赋值）

- 打开编辑抽屉后，外部异步设置 `formData.queries`，DataQueryTab 能正确 reset 并展示
- 切换到另一个 panel 编辑时（sessionKey 变化），旧 panel 草稿不会残留

### 7.3 QueryBuilder 操作区

- 添加 SUM 后立即出现 1 个空 label 行（不需要再点 `+ Label` 才出现下拉）
- label 下拉无搜索框（showSearch=false）
- 清空 label 时不会生成 `sum("", inner)` 这类脏 PromQL
- tooltip 不再出现 `Extraneous non-props attributes (placement)` 的 Vue warning

### 7.4 Code <-> Builder 切换与 warnings

- Builder 生成 PromQL，切换到 Code 后能带过来
- Code 修改一个常量（例如 `+ 3` -> `+ 4`），再切回 Builder：
  - 能反解析则正确展示
  - 不能反解析则：
    - Builder 显示 warning（指出哪些片段没识别，已过滤）
    - 不崩溃，不产生错误状态污染其它 query

### 7.5 refId 唯一性

- A/B/C 中删除 B，再新增，应变为 B（或下一可用），不会重复

---

## 8. 开发/构建注意事项（避免 TypeScript “看起来随机报错”）

当前 dashboard 的 tsconfig 把 `@grafana-fast/utils` 指向 `../utils/dist/index.d.ts`：

- 这意味着 **在跑 dashboard 的 `vue-tsc` 前，需要先 build utils**。

推荐命令（按需执行）：

- `pnpm -C packages/utils run build`
- `pnpm -C packages/dashboard exec vue-tsc --noEmit`
- `pnpm -C packages/utils run test:promql-parse`

---

## 9. 相关文件地图（你后续要改这里）

- DataQueryTab（主模块）：`packages/dashboard/src/components/PanelEditor/DataQueryTab.vue`
- 父组件集成（保存/执行契约）：`packages/dashboard/src/components/PanelEditor/PanelEditorDrawer.vue`
- 操作列表（QueryBuilder 操作区）：`packages/dashboard/src/components/QueryBuilder/query-builder/OperationsList.vue`
- PromQL 反解析器（best-effort）：`packages/utils/src/promql/parsePromqlToVisualQuery.ts`
- Select 公共组件（slot/variant/高度）：`packages/component/src/components/form/Select.vue`
- Tooltip 公共组件（placement/$attrs）：`packages/component/src/components/feedback/Tooltip.vue`
