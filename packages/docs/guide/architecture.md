# 架构概览

本仓库的目标是提供「可嵌入的 Dashboard SDK」与「可扩展的仪表板体验」，因此整体架构拆分为：

- `@grafana-fast/types`：领域模型（Dashboard/Panel/Query/Variable 等）+ 内部 schema 迁移能力
- `@grafana-fast/api`：数据访问层（契约层 + 实现层），屏蔽后端入参/出参变化对 UI 核心包的影响
- `@grafana-fast/dashboard`：仪表板体验（渲染 + 编辑 + QueryBuilder + Tooltip 联动）
- `@grafana-fast/panels`：面板插件注册/筛选工具（`all().exclude().insert()`）
- `@grafana-fast/hooks`：组合式 SDK，提供 `useDashboardSdk` 用于嵌入

## 依赖方向

推荐的依赖方向（避免循环依赖）：

`types` → `api` → `dashboard` → `hooks`

`panels` 依赖 `dashboard`（用于读取内置 panel 插件定义），但 `dashboard` 不依赖 `panels`。

## 运行时注入（契约层）

Dashboard 运行时通过注入拿到：

- `apiClient`：由 `@grafana-fast/api` 提供，默认 mock；后续可切换 `http` / `prometheus-direct`
- `panelRegistry`：面板插件注册表；未注册类型将以 `UnsupportedPanel` 占位（不丢信息）

## 多实例隔离

多 dashboard 同页嵌入时需要隔离：

- Pinia 实例（默认 `useDashboardSdk` 会创建独立 pinia，避免 store 污染）
- Tooltip/快捷键/事件监听（通过 runtime scope 限制作用域）

