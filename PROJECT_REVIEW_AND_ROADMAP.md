# grafana-fast / demo-perses 项目评审与路线图（面向“超越 Grafana”）

> 目标读者：项目 Owner/核心开发者  
> 目标：在保持 Grafana 核心 Dashboard 能力的基础上，通过“可嵌入 + 插件化 + 可移植 JSON + 性能/调试体验”在多个领域超越 Grafana。  
> 范围：基于当前仓库 `demo-perses`（pnpm monorepo）代码现状的评审与可执行计划。  

---

## 1. 你现在在做的到底是什么（定位要非常清晰）

Grafana 是“完整产品”（含服务端、权限、数据源管理、告警、团队协作、生态市场）。  
而 `grafana-fast` 更适合走 **Embedded-first Dashboard Engine（可嵌入仪表板引擎）** 路线：

- 你提供的是 **SDK/组件引擎**：宿主应用把它当作可嵌入的 dashboard runtime。
- **宿主负责**：用户体系、鉴权、权限、组织/文件夹、分享策略、后端存储与审计等“产品/平台”能力。
- **你负责**：渲染与编辑体验、查询编排、变量系统、JSON 可移植、插件系统、性能与调试能力。

这条路线有一个天然优势：**Grafana 在“多实例同页嵌入、强隔离、无全局副作用”上很难做到极致**，而你可以。

---

## 2. 当前仓库现状（我看到的“已成形的关键底座”）

### 2.1 Monorepo 包职责划分（优点：边界清晰）

当前 `packages/*` 基本形成了良好的分层：

- `packages/types`（`@grafana-fast/types`）
  - 领域模型：Dashboard/Panel/Query/TimeRange/Variable 等
  - 目前 `schemaVersion` 只是“保留字段”，migration 目录为空（这会影响“JSON 可迁移”的长期承诺）
- `packages/api`（`@grafana-fast/api`）
  - 合同层 contracts + 实现层 impl（mock/http/prometheus-direct）
  - UI 只依赖稳定接口：`GrafanaFastApiClient`
- `packages/store`（`@grafana-fast/store`）
  - 轻量 Pinia-like，重点解决 **多实例隔离**（组件上下文 injected pinia 优先）
- `packages/component`（`@grafana-fast/component`）
  - 自研 UI kit（成本高，但可换来一致的 dashboard 风格与可控性）
- `packages/dashboard`（`@grafana-fast/dashboard`）
  - Dashboard 体验与运行时：面板渲染、编辑器、QueryBuilder、tooltip、调度器等
- `packages/hook`（`@grafana-fast/hooks`）
  - SDK 入口：`useDashboardSdk`，负责“嵌入式挂载 + pinia 隔离 + apiClient 注入 + 生命周期”

这套结构本身就是“可维护性优势”：未来你要做插件系统、AI、企业能力，**能在明确边界内演进**。

### 2.2 目前最值得肯定的工程化设计（这些是你超越 Grafana 的根）

以下几处设计非常关键，建议继续保持并进一步产品化：

- **实例隔离（pinia + runtime context）**
  - `packages/dashboard/src/runtime/keys.ts`
  - `packages/dashboard/src/runtime/piniaAttachments.ts`
  - `packages/hook/src/useDashboardSdk.ts`
- **QueryScheduler + QueryRunner**
  - `packages/dashboard/src/query/queryScheduler.ts`：集中调度、可视区域刷新、变量依赖刷新、取消与代际
  - `packages/dashboard/src/query/queryRunner.ts`：并发、缓存、in-flight 去重、变量插值
- **Transformations（数据变换层）**
  - `packages/dashboard/src/transformations/index.ts`：可序列化链式变换，是“插件生态”的关键一环
- **严格 JSON 校验入口（阻止坏 JSON 污染运行时）**
  - `packages/dashboard/src/utils/strictJsonValidators.ts`

这些点组合在一起，天然更适合做成“嵌入式引擎”，而不是去复刻 Grafana 的整套产品。

---

## 3. 从“代码层面”看：做得好的、需要改的、以及为什么

### 3.1 做得好的（建议作为稳定内核长期维护）

- `QueryScheduler` 的“只刷新可视区域 + 条件代际 + cancel 语义”是很强的工程实现
  - 对大盘/长列表，Grafana 常见痛点是请求风暴、卡顿、难排障；你这个方向是正确的
- contracts/impl 分层清晰，未来换后端、加数据源，不会拖垮 UI
- store 的 injected pinia 优先策略，适配“同页多 Vue App / 多 dashboard”是差异化关键

### 3.2 需要尽快处理的技术债（否则会阻碍迭代速度）

1) **类型系统被 `any` 稀释（尤其在 QueryBuilder/编辑器）**  
现状：`packages/dashboard/src/components/...` 中存在较多 `any`，会导致：
   - 面板/查询/变量结构升级时，IDE 不能帮你找引用
   - 插件化后，schema 变化会变得不可控

建议：  
   - 把 `any` 收敛到“边界层”（例如解析外部 JSON、HTTP DTO），核心模型使用 `@grafana-fast/types`
   - 对 PanelOptions、TransformationOptions 引入更明确的类型（哪怕先是 discriminated union）

2) **“插件元信息”不够完整，导致面板编辑器里出现硬编码映射**  
现状：`PanelEditorDrawer.vue` 里维护了：
   - panel type -> style component map
   - panel type -> default options map  

这会导致：每新增一个 panel type，至少要改 2~3 处，还容易漏（可维护性差）。  

建议（很关键）：把 PanelPlugin 扩展为：
   - `type/displayName/component`
   - `defaultOptions()`
   - `editor`（style tab schema/component）
   - `migrations`（options schemaVersion）  
然后让 PanelEditor/PanelContent 都只依赖 registry 的能力。

3) **Dashboard JSON 与运行时 store 的“单一事实源”不够统一**  
观察到的风险点：
   - variables 会写回 dashboard JSON（`variablesStore.applyToDashboard`）
   - timeRange/refreshInterval 目前更多是 store 内部状态，不一定会写回 Dashboard JSON

这会影响：导出/保存之后“再导入是否可复现”。  

建议：明确策略（二选一）：
   - A：Dashboard JSON 是 source of truth（store 只是运行时投影），任何变更都写回 JSON
   - B：运行时 store 是 source of truth，导出时进行“serialize”（生成完整 JSON）

SDK 产品化时，A 更直观；工程实现上，B 更灵活但要求 serialize/migrate 做得更严谨。

4) **文档/代码不一致点会反噬信任**
典型例子：
   - `packages/types/src/dashboard.ts` 写“未上线不提供 migration”
   - `FUTURE.md` 中把 migration 作为长期底座强调
   - `tsconfig.base.json` 里存在 `@grafana-fast/panels` 路径，但仓库当前没有该包

建议：把“承诺项”尽早落地一个最小可用版本（见第 6 节的近期计划）。

---

## 4. 从“可维护性/架构演进”看：你要把精力花在哪些关键抽象上

### 4.1 你需要一个“稳定内核”（Core）与“可替换外壳”（Extensions）

建议把能力拆成三层（并在代码结构中显式体现）：

1) **Core（稳定内核）**
   - Dashboard JSON schema + migration
   - Query execution contracts（CanonicalQuery / QueryResult）
   - QueryScheduler/Runner（调度、缓存、取消、debug）
   - Transformations pipeline（可序列化、可迁移）

2) **Plugins（可替换扩展）**
   - Panel plugins（渲染 + editor schema + default options + migrations）
   - Datasource plugins（capabilities + QueryBuilder adapter）
   - Transformation plugins（worker 化执行也可以在这里演进）

3) **Host Integration（宿主集成层）**
   - 鉴权与请求策略（headers/token/签名）
   - 用户权限、审计、保存策略、资产中心（folders/tags/search）
   - 埋点与 A/B

这样你不会陷入“像 Grafana 一样什么都做”，但仍能实现“Grafana 的核心 dashboard 能力 + 在若干关键领域超越”。

### 4.2 测试策略：不需要重依赖，也能建立“回归护城河”

仓库现在的风格倾向“轻量测试脚本”（例如 `packages/utils/scripts/promql-render.test.ts`）。  
这个思路很好，建议把以下内容都纳入同类脚本回归（Node assert 即可）：

- `QueryRunner`：并发限制、in-flight 去重、缓存 TTL、Abort 语义
- `interpolateExpr / extractVariableRefs`：变量语义与边界 case
- `applyTransformations`：链式执行与数据拷贝正确性
- `strictJsonValidators`：坏 JSON 不落地、错误信息稳定

目标不是高覆盖率，而是：**每次重构核心链路都不心虚**。

---

## 5. 对标 Grafana：哪些是“核心必须有”，哪些应该交给宿主

### 5.1 建议你先定义“Grafana 核心”的最小闭环（SDK 视角）

如果你的定位是 embedded SDK，那么“Grafana 核心”更像下面这些（按优先级）：

P0（必须有，否则很难说“具备 Grafana 核心能力”）
- Dashboard：加载/保存/导入/导出（JSON 一致性）
- Panel：增删改、布局拖拽缩放、全屏查看
- Query：最少 1 个主流数据源（当前是 Prometheus-like）
- Variables：select/query/input/constant + includeAll/multi + 插值语义稳定
- TimeRange：相对/绝对、刷新、对齐到查询执行
- Transformations：至少具备可组合链 + 可序列化到 JSON
- Inspect（最少做一个 Query Inspector）：看请求、看耗时、看错误、看缓存命中

P1（能显著逼近 Grafana 日常体验）
- Field config / overrides（阈值、单位、颜色映射、displayName）
- 更多 transformation（join/merge/reduce/pivot/rename/labels-to-fields）
- 面板交互：hover 联动、点击跳转（links/drilldown）
- Dashboard 资产治理：lint、重复 query 检测、变量命名规范

P2（产品级能力，通常需要后端/平台配合）
- folder/tag/search、版本历史、回滚、差异对比
- RBAC/权限、分享策略、审计日志
- annotations、alerts（真正做全套会很重，建议先做“事件标记/注释”）

### 5.2 “超过 Grafana”的领域建议（不要贪多，先赢 3 个点）

建议选 3 个可形成护城河的方向（并把资源集中）：

方向 A：Embedded-first（多实例强隔离 + 微前端友好）
- 同页多 dashboard：状态/快捷键/tooltip/scheduler 全隔离
- 零全局副作用：CSS、事件监听、缓存/定时器都可释放
- Host 可控：网络/鉴权/主题/埋点完全由宿主管

方向 B：性能 + 调试体验（Grafana 的典型弱点）
- “可视区域刷新 + 队列调度”已经有雏形
- 下一步做成可视化 Query Inspector（debug snapshot + timeline）
- 提供“为什么慢/为什么没数据”的可解释性（甚至 AI 辅助）

方向 C：JSON 可移植 + 治理（企业真正愿意买单的点）
- schemaVersion + migrations（必须落地）
- 导出永远稳定、可重放
- lint + 标准化：命名、变量一致性、重复 query 合并建议

---

## 6. 我建议你“现阶段应该怎么做”（按 2~6 周可交付拆分）

下面是一个以“尽快可产品化”为目标的行动清单。你可以把它当作 2~3 个 Sprint 的 backlog。

### Sprint 1（1~2 周）：把“内核一致性”补齐

目标：让 SDK 的导入/导出/运行时行为一致，降低后续插件化成本。

- 统一 source of truth：明确 timeRange/refreshInterval/variables 与 Dashboard JSON 的同步策略
- 清理不一致项
  - `@grafana-fast/panels` 路径与实际包（要么补包，要么移除配置）
  - `types` 的 migration 方向：哪怕先做“空迁移框架”，也要有真实入口
- 让 PanelPlugin 承担更多元信息（默认 options、editor 配置、migrations），减少编辑器硬编码
- 增加 4 类最小回归脚本（见第 4.2）

验收标准：
- 导出 JSON -> 导入 -> 渲染结果一致（timeRange/variables/transformations 都一致）
- 新增一个 panel type 时，不需要在 3 个地方各写一份映射

### Sprint 2（2~3 周）：做一个“Query Inspector”（这是你最容易超越 Grafana 的抓手）

目标：把 QueryScheduler 的 debug 信息产品化，形成差异化。

- 在 UI 中提供一个 Inspector 面板（可挂在 DashboardToolbar 的 “更多” 菜单）
- 至少展示：
  - pending queue 数量、inflight 数量、top pending tasks（你已有 `debug snapshot`）
  - 每个 panel 最近一次执行：开始/结束/是否取消/错误摘要/缓存命中（需要扩展 QueryRunner 输出或 debug 事件）
- 支持一键复制诊断信息（给用户/运维排障）

验收标准：
- 100 panels 场景下，用户能解释“现在为什么慢/谁在排队/谁失败”

### Sprint 3（3~6 周）：插件化的第一步（先做 transformations 插件化，收益最大）

目标：把“可扩展能力”从代码结构变成真实可用的生态入口。

- Transformations 插件 registry：内置 + 自定义注册
- 让 transformation options 具备 schemaVersion + migration（从一开始就设计好）
- 引入 worker 化执行的预留（先不做，留接口）

验收标准：
- 复杂 panel（table/stat）不靠面板堆代码，而靠 transformation chain 组合实现
- transformation 缺失时不崩溃、不丢配置（类似 UnsupportedPanel 的语义）

---

## 7. 你要怎么“在多个领域超过 Grafana”（战略建议）

Grafana 的护城河是生态和深度。你要赢，必须 **避开正面战场**，打你更容易赢的战场：

1) **把自己当成 SDK，而不是产品**
   - 你不需要复刻 Grafana 的组织/权限/分享/告警全家桶
   - 你要做的是“让任何产品都能拥有 Grafana 级 dashboard 能力”

2) **把“调试/可解释性”做成产品卖点**
   - 大多数团队不是缺图表，而是缺“为什么不对/为什么慢”的解释
   - Query Inspector + Diagnostics +（可选）AI Debug 是你最容易形成差异化的组合

3) **把 JSON 的稳定性当成资产**
   - 企业里 dashboard 是资产：迁移、升级、治理比“多一个图表类型”更值钱
   - 你的 schemaVersion + migration + lint/治理 是长期价值

4) **垂直领域“快赢”（超过 Grafana 的现实路径）**
   - Grafana 很强，但做“某一领域的极致体验”往往慢
   - 你可以选择 1~2 个领域做“模板/面板/QueryPatterns/最佳实践”打包
     - 例如：NGINX、K8s、DB、业务链路等
   - 让用户“一键生成可用 dashboard”，这会比“多一个 panel 类型”更有冲击力

---

## 8. 下一步如果你愿意，我可以继续做什么

你如果确认“先做哪 3 个差异化方向”，我可以继续帮你把计划落到更细粒度的工程任务，例如：

- 输出一份 `RFC: Plugin System v1`（panel/transformation/datasource 的最小契约）
- 把 QueryInspector 做成一个可合并的 PR（UI + debug 数据结构）
- 补齐“Dashboard JSON 与 store 同步”的一致性改造（并附带回归脚本）
- 给 `PanelEditorDrawer` 做一次结构化重构：去硬编码映射、修复默认 options 逻辑、增强类型约束

