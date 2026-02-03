# FUTURE / 路线图（目标：在体验上超越 Grafana）

> 这份文件不是“需求堆栈”，而是从整个项目架构与业务闭环出发，为 `grafana-fast` 规划的长期路线图。
> 核心目标：把它做成一个 **Embedded-first（可嵌入优先）**、**SDK-first（宿主集成优先）**，并且在 **性能与调试体验** 上能超过 Grafana 的 Dashboard 引擎。

## 0. 我们到底在做什么（用一句话对齐）

`grafana-fast` 不是 “再做一个 Grafana UI”，而是一个可被任何宿主应用嵌入的 Dashboard 引擎：

- 对宿主而言：它是一个 SDK（`@grafana-fast/hooks` + `useDashboardSdk`），能在任何页面里挂载多个 dashboard 且互不干扰。
- 对业务而言：它是一个“可嵌入的视图系统”：用户复制粘贴 JSON 就能展示内置面板；不支持的面板类型会被严格校验拦截（避免 silent fallback）。
- 对工程而言：它是一个“稳定的核心 + 可替换的数据访问层 + 可插拔的渲染层”。

## 0.1 当前阶段的范围（明确冻结/删减项）

为了“功能够用但心智负担更低”，当前仓库明确不做/已移除：

- **Prometheus Direct（直连 Prometheus）**：不在范围内，已从实现与文档中移除。
- **Panel 插件化/面板可裁剪/缺插件恢复**：当前仅支持固定内置面板类型；`panel.type` 严格校验，未知类型不会被兼容导入。
- **schema migration**：当前不提供内置迁移/兼容逻辑；`schemaVersion` 仅作为持久化字段保留（用于未来演进）。
- **Query Inspector**：不做；错误展示保持“简短摘要”（够排障，不占心智）。
- **Transformations**：保留执行层口子，但不开放 UI 配置入口（作为内部数据修饰能力使用）。

## 1. 现状盘点：当前项目的“业务闭环”已经长什么样了

### 1.1 包结构与职责边界（当前已形成的架构）

项目当前拆分为（以 monorepo packages 为准）：

- `@grafana-fast/types`
  - 领域模型：`Dashboard / Panel / PanelGroup / Layout / Query / Variable` 等
  - `schemaVersion`（保留字段）：当前仅做持久化；不内置 migration（未来需要再补）
- `@grafana-fast/api`
  - 数据访问层：**契约层（contracts）** + **实现层（impl）**
  - 实现层当前默认 `mock`，并预留 `http` 实现入口
  - 目标是：后端接口变化尽量只影响实现层，不影响 dashboard 核心包
- `@grafana-fast/dashboard`
  - 仪表板体验包：渲染、编辑、QueryBuilder、Tooltip 联动等
  - 核心特性：运行时注入 `apiClient`，并做多实例隔离
  - 查询体系：`QueryScheduler`（调度）+ `QueryRunner`（执行）+ 变量插值/依赖分析
- `@grafana-fast/store`
  - 轻量 Pinia-like：支持多实例隔离（组件上下文优先 `inject('pinia')`）
- `@grafana-fast/hooks`
  - SDK 入口：`useDashboardSdk`
  - 负责：pinia 隔离策略、主题、load/save、apiClient 注入与生命周期管理
- `packages/app`
  - 演示站点（未来可升级为“回归验证平台”）
- `packages/docs`
  - 文档站（未来可成为生态入口）

### 1.2 核心业务流（从 JSON 到出图）

当前的核心闭环已经形成：

1. **Dashboard JSON**（`@grafana-fast/types`）进入系统  
   - `useDashboardSdk` / `dashboardStore.loadDashboard()` 拉取或导入 JSON  
   - `validateDashboardStrict` 负责严格校验（`schemaVersion:number`、`panel.type` 必须是内置类型等）
2. **运行时注入**  
   - `apiClient`（mock/http）注入到 pinia 实例上  
   - 面板类型由内置映射解析；渲染层对不支持类型会兜底 `UnsupportedPanel`（避免崩溃）
3. **变量系统**（VariablesStore）  
   - 从 dashboard.variables 初始化 `values/options`
   - query-based variable 的 options 由 `api.variable.resolveOptions`（best-effort）
4. **查询调度与执行**（QueryScheduler + QueryRunner）  
   - timeRange 变化：刷新全部  
   - variable 变化：基于表达式依赖分析，仅刷新受影响 panel  
   - `QueryRunner`：并发限制、缓存、取消（AbortSignal）、in-flight 去重
5. **面板渲染**  
   - `panel.type` -> 内置面板映射查找对应渲染组件  
   - 不支持：`UnsupportedPanel` 展示类型 + 原始 options（可复制）

这条链路是“超过 Grafana”的基础：因为你掌握了 **宿主/运行时**，可以把隔离、稳定性、可移植性做得比 Grafana 更极致。

## 2. “超越 Grafana”要赢在哪里（对齐差异化）

Grafana 的优势是生态与深度，但它也有典型弱点。`grafana-fast` 更容易赢的点是：

### 2.1 Embedded-first：把“可嵌入”做到 Grafana 做不到的级别

Grafana 本质是产品，而你在做 SDK。你可以做到：

- 同页多 dashboard 的绝对隔离：状态、tooltip、scheduler、快捷键、主题都 scoped 到 runtime 实例
- 宿主可控：宿主可完全控制 API 客户端、鉴权、网络策略、主题策略、全局埋点
- 微前端友好：避免全局副作用（window 事件监听、全局 store 单例、全局 CSS 覆盖）

### 2.2 JSON 可移植：导入/导出可预测，比 Grafana 更“稳”

目标不是兼容 Grafana JSON，而是：

- 当前阶段不承诺“旧版本自动兼容”：不内置 migration；仅保留 `schemaVersion` 持久化字段为未来演进留口子
- 导入/导出要可预测：同版本内 round-trip 不丢信息（保存/导出时序列化出一致 JSON）
- 面板类型严格：未知 `panel.type` 会被校验拦截；渲染层仍提供 `UnsupportedPanel` 兜底避免崩溃

### 2.3 调试体验：把“查询与变量”变成一等公民（Grafana 反而不够产品化）

你可以把“调度器”做成用户看得见、用得上的能力：

- **查询可观测性**：每个 panel 的 query timeline（开始/结束/取消/命中缓存/耗时/错误）
- **插值预览**：PromQL 在当前变量/时间范围下最终会是什么表达式（极其提升排障效率）
- **依赖可视化**：变量变化会影响哪些 panel（避免用户不理解为什么刷新慢/为什么没刷新）

### 2.4 性能：重做“感知性能”，超过 Grafana 的体感

Grafana 在大盘（100+ panels）时也会吃力。你可以通过更彻底的工程化来赢：

- 面板分批渲染 + 虚拟化（按可视区域与 idle time）
- 数据复用：同 queryKey + timeRange 共享结果（跨 panel 复用），避免重复请求
- transformations 放到 worker（避免阻塞 UI）
- Monaco 等重依赖全部按需加载（编辑器打开才加载）

## 3. 未来路线图（按里程碑 / 可验收 / 可回归）

> 每个阶段都应该有明确的“Definition of Done（DoD）”，并在 `packages/app` 里有对应的验证页面（回归矩阵）。

### Milestone A：稳定性与可回归（先把底盘做硬）

**目标**：任何重构都不再靠“手测碰运气”，而是有稳定的回归资产。

- 建立 `packages/app` 的“能力验证矩阵”
  - mock vs http（预留）
  - 变量联动 + 依赖刷新
  - JSON 导入/导出 round-trip（同版本不丢信息）
  - 100 panels 压测页（关键 KPI）
- 建立最小自动化回归：
  - unit：`validateDashboardStrict`、`interpolateExpr`、`extractVariableRefs`、`QueryRunner cacheKey`、`QueryScheduler deps`
  - e2e（最小覆盖）：打开 dashboard -> 出图 -> 打开编辑器 -> 修改 -> 导出 -> 再导入
- 工具链稳定：
  - 固化 Node 版本（建议加入 `.nvmrc` 或 `volta` 配置），避免开发者环境不一致导致构建失败

**验收标准**：
- 能在 CI/本地一键跑通类型检查 + 单测（即使不跑 Vite build，也要有可验证的核心逻辑测试）
- 关键链路（导入/渲染/查询/编辑/导出）有自动化回归

### Milestone B：Dashboard JSON 产品化（导入/导出/诊断）

**目标**：让“复制粘贴 JSON”成为真正可靠的产品能力，而不只是 demo。

- schemaVersion（保留字段）
  - 当前仅做持久化（不内置 migration/兼容）
  - 未来如需演进 schema，再补 migration 框架（并配套回归样例与变更摘要）
- JSON 校验与诊断（比 Grafana 更好用）
  - 导入前预检：未知字段、非法类型、变量未定义、datasourceRef 缺失
  - 导入后报告：哪些字段不符合约束/被忽略（保证用户知道“导入后会发生什么”）

**验收标准**：
- 同版本 dashboard JSON 可导入并展示；导出再导入结果一致（round-trip 可回归）

### Milestone C：变量系统升级为“可解释的模型”

**目标**：变量不仅是 UI 组件，而是“查询执行模型”的一部分。

- 变量类型与语义补齐
  - select/input/constant/query-based variable
  - multi、includeAll、allValue、（可扩展）regex 过滤、sort、refresh on timeRange 等
- 插值策略完善
  - 支持 `$var` / `${var}` / `[[var]]`
  - multi 渲染策略可配置：regex / csv / prom label matcher
  - 插值预览（UI 能看到最终表达式）
- 依赖分析加强
  - 不仅按 `expr` 提取变量引用，也要考虑 transformations、legend、panel options 中可能的变量引用（逐步扩展）

**验收标准**：
- variable change 只刷新受影响 panel（已具备雏形），并能在 UI 上解释“为什么刷新这些”
- query-based variables 能从 datasource 拉取 options（mock 实现先完整，后续接真实实现）

### Milestone D：查询引擎升级为“调度平台”（超过 Grafana 的关键）

**目标**：把 QueryRunner/Scheduler 做成一个可治理、可观测、可扩展的执行平台。

- 并发治理
  - dashboard 级别并发上限
  - panel 内多 query 的队列策略（公平性、优先级：可视区域优先）
- 取消与过期语义完善
  - timeRange/变量变化触发：取消上一轮，并标记为“过期结果不落地”
- 缓存策略升级
  - TTL、LRU、负缓存
  - cacheKey 可扩展：包含 datasourceRef、interval、downsample、transform chain 等
- 查询可观测性（强烈建议做成可视化面板）
  - timeline：start/end/cancel/cache-hit/queue-wait
  - 错误聚合与诊断建议（例如 PromQL 常见错误）

**验收标准**：
- 100 panels 情况下不会出现“请求风暴”，并且可明确解释当前队列状态
- 有一套“可视化调试”入口可以定位：哪个 panel 慢、慢在哪、是否被取消

### Milestone E：插件生态（Panel + Transformations + Datasource）

**目标**：实现“插件化不是堆功能”的长期可持续扩展（**后置/可选**）。

- Panel 插件体系升级
  - 插件元信息：displayName、category、capabilities、schemaVersion、migrations
  - 编辑器可配置：query tab、style tab、transform tab 的 schema 化渲染
  - 运行时隔离：插件错误边界，不影响 dashboard 主体
- Transformations 插件体系（强烈建议优先）
  - merge series、reduce、rename、threshold mapping、table pivot…
  - 可组合，可序列化到 JSON（并支持 migration）
  - worker 化执行（大盘性能关键）
- Datasource 插件（长线）
  - contract 层保持稳定，上层用 capabilities 决定 UI 展示
  - http / mock 的能力差异可被 UI 自动降级处理

**验收标准**：
- 插件/扩展能力可裁剪、可注入、可回归（不引入宿主心智负担）
- transformations 能显著提升 stat/gauge/table 表现力（接近并可部分超越 Grafana）

## 4. AI 方向：要不要加？加什么？怎么加才不会“噱头化”

AI 不是“加个聊天框”就超越 Grafana。AI 真正能让你赢的是：**把复杂性压缩成更少的操作、更少的试错**。

### 4.1 AI 最值得做的 3 类能力（建议从低风险/高收益开始）

#### (1) 创作辅助（Authoring Assistant）

目标：让用户更快做出一个“可用的 dashboard”。

- 自然语言 -> 生成 dashboard JSON（带 schemaVersion）
  - 关键：生成的不是一次性文本，而是一个可验证的结构化 JSON
- query 辅助
  - PromQL 片段补全、常见模板（rate/sum by/avg_over_time）
  - 在当前变量语义下，给出更正确的插值写法
- 面板推荐
  - 根据 query result shape（time_series / table / scalar）推荐面板类型与默认 options

#### (2) 调试辅助（Debug Assistant）

目标：减少“为什么不出图/为什么慢/为什么数据怪”的排障成本。

- 当 query 报错时：给出解释与修复建议（可基于常见 PromQL 错误库 + LLM）
- 当图表为空时：提示可能原因（timeRange 太短、变量为空、label 不匹配、被 hide）
- 当 dashboard 性能差时：提示瓶颈（并发上限、缓存未命中、某 panel 超慢）

#### (3) 治理与标准化（Governance Assistant）

目标：让大量 dashboard 资产可维护（这在企业里比“炫技”更值钱）。

- Dashboard JSON lint：命名规范、变量命名规范、重复 query 去重建议
- migration 助手：当你升级 schemaVersion 时，自动生成迁移报告与 PR 建议

### 4.2 AI 融入的工程原则（避免引入安全/成本黑洞）

- **默认不上传用户数据**：AI 能力必须可配置（off by default / BYO key）
- **分层**：AI 只给建议，不直接写入 store；所有写入都走“可回滚的草稿层”
- **可验证**：AI 输出必须转换为结构化模型并走校验（schema 校验 + capabilities 校验）
- **可回放**：AI 生成的 dashboard 要能导出 JSON，并可在无 AI 环境下继续使用

### 4.3 什么时候再做“智能分析/异常检测”

异常检测/根因定位很酷，但容易变成“数据与算法投入黑洞”。建议排在后面：

- 先把 QueryRunner 的可观测性做出来（你自己先能解释“慢在哪”）
- 再基于真实数据/真实用户的 pain points 决定是否做：
  - 异常检测（anomaly）
  - 变更关联（deploy markers）
  - 根因推断（RCA）

### 4.4 AI 接入方式建议（建议提前设计“可插拔”，避免绑死某一家）

如果决定引入 AI，建议和 `@grafana-fast/api` 一样做“契约层 + 实现层”的分层思路（哪怕第一版只做 mock）：

- 契约层（建议未来单独抽一个 `@grafana-fast/ai` 或放在 `@grafana-fast/api` 下的子 service）
  - `assistant.suggestDashboard(input, context)`：生成/补全 dashboard JSON（返回结构化结果 + diagnostics）
  - `assistant.suggestQuery(input, datasourceRef, variables)`：生成 PromQL/建议写法（返回候选 + 置信度 + 风险提示）
  - `assistant.explainError(error, query, context)`：解释错误并给修复建议
  - `assistant.lintDashboard(dashboard)`：lint + 标准化建议（低风险、很适合先做）
- 实现层（Providers）
  - `mock`：用于本地开发与回归（保证功能链路可测）
  - `openai/azure-openai/...`：云端模型（BYO key）
  - `local`：本地模型（可选，适合对隐私敏感的企业/内网环境）

建议在 UI 层坚持一个原则：**AI 的输出永远不直接“写 store”**，而是先进入“草稿/预览层”，用户确认后再落库/写入 dashboard JSON。

### 4.5 AI 安全与隐私（这决定 AI 能不能在企业落地）

AI 一旦进入“可观测数据域”，会马上遇到企业级合规与安全要求。建议提前定好硬规则：

- 默认关闭（off by default），并且清晰告知“会发送什么”  
- 支持 BYO key / 自建代理（企业内部统一审计与脱敏）
- 数据最小化：默认只发送 **schema/结构/错误信息**，不发送原始时序数据
- Prompt injection 防护：任何来自 datasource/label 的文本都需要被当作“不可信输入”处理
- 结果可追溯：保存 AI 操作日志（至少在开发模式下）——谁生成的、依据是什么、改了哪些字段

> 关键观点：AI 的价值不在“更炫”，而在“更省时间、更少试错、更可治理”。这些能力一旦产品化，会比 Grafana 现有的 AI 玩法更稳定、更可控。

## 5. 风险清单（提前规避，才能跑得快）

- **循环依赖风险**：`dashboard/hooks/api/types` 的依赖方向必须持续保持（避免 runtime/import 混乱）
- **全局副作用风险**：tooltip/keyboard/window event 必须严格 scoped（否则多实例会出诡异 bug）
- **性能风险**：ECharts + 大盘 + transformations 如果不做 worker/分批渲染，很快会撞墙
- **契约漂移风险**：后端接口变化会不断发生，contract 层必须稳定，变动尽量消化在 impl 层
- **范围膨胀风险**：过早引入插件化/migration/复杂编辑器，会显著增加代码量与阅读负担（需明确 DoD 与回归资产）

## 6. 你要如何“超过 Grafana”（一句话的执行策略）

不要试图在“面板种类数量”上短期超过 Grafana；而是用你的架构优势去赢：

1) **把 JSON 可移植做到极致**（稳定导入/导出 + 严格校验 + schemaVersion 预留）  
2) **把查询与变量的调试体验做到极致**（插值预览 + 查询 timeline + 依赖可视化）  
3) **把可嵌入与多实例隔离做到极致**（宿主可控、无全局副作用、性能可治理）  
4) 在可回归前提下逐步扩展 transformations/datasources（必要时再引入插件化）

---

## 附录：与现有文档的关系

- 架构概览：`packages/docs/guide/architecture.md`
- Dashboard JSON：`packages/docs/guide/dashboard-json.md`


## 个人总结
- 加入 AI 能力（可选）
