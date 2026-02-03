# 架构概览

本仓库的目标是提供「可嵌入的 Dashboard SDK」与「可扩展的仪表板体验」，因此整体架构拆分为：

- `@grafana-fast/types`：领域模型（Dashboard/Panel/CanonicalQuery/Variable 等）
- `@grafana-fast/api`：数据访问层（契约层 + 实现层），屏蔽后端入参/出参变化对 UI 核心包的影响
- `@grafana-fast/dashboard`：仪表板体验（渲染 + 编辑 + QueryBuilder + Tooltip 联动）
- `@grafana-fast/hooks`：组合式 SDK，提供 `useDashboardSdk` 用于嵌入

## 依赖方向

推荐的依赖方向（避免循环依赖）：

`types` → `api` → `dashboard` → `hooks`

当前阶段 dashboard 仅支持内置的固定 Panel 类型（不提供对外的筛选/裁剪/插件化能力）。

## 运行时注入（契约层）

Dashboard 运行时通过注入拿到：

- `apiClient`：由 `@grafana-fast/api` 提供，默认 mock；后续可切换 `http`
- 渲染层对未知的 `panel.type` 会使用占位面板兜底（避免崩溃）

## 多实例隔离

多 dashboard 同页嵌入时需要隔离：

- Pinia 实例（默认 `useDashboardSdk` 会创建独立 pinia，避免 store 污染）
- Tooltip/快捷键/事件监听（通过 runtime scope 限制作用域）
