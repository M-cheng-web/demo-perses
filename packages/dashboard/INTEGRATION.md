# Dashboard 集成指南（面向宿主应用）

本指南以 **嵌入式（embedded-first）** 为前提，帮助你把 `@grafana-fast/dashboard` 安全地集成到任意宿主应用中。

> 不涉及后端接口对接（apiClient 由宿主自行实现/注入）。

## 1. 最小集成（推荐：useDashboardSdk）

如果你希望快速落地、并且需要“同页多实例隔离 + 自动清理”，推荐直接使用：

- `@grafana-fast/hooks` 的 `useDashboardSdk`

它会负责：

- Pinia 实例隔离（默认 isolate）
- apiClient 注入到 runtime
- Dashboard mount / unmount 生命周期

## 2. 直接使用组件（DashboardView）— 已禁用

当前仓库仅支持 **SDK 挂载（useDashboardSdk）**。

如果你尝试直接渲染 `DashboardView`：

- 运行时会给出 `console.warn`
- 组件会渲染错误提示并拒绝加载

目的：避免“宿主绕过 SDK”导致 pinia/runtime/清理策略不一致，引发多实例串台、资源泄漏等问题。

## 3. 主题策略（不污染宿主）

`@grafana-fast/component` 的主题 token 默认挂在：

- `.gf-theme-light` / `.gf-theme-dark`（`.gf-theme-blue` 为兼容别名）
- `[data-gf-theme="light" | "dark"]`

不会自动改写宿主的 `html/body`，以避免“嵌入式污染”。

建议：

- 宿主应用想全站接管主题：由宿主自己决定把 `data-gf-theme` 放在哪（documentElement 或局部容器）。
- 只想让 dashboard 自己切换：通过 SDK 的 `themePreference` / `actions.setTheme()` 控制。

## 4. 销毁与清理（多实例场景）

如果你使用 `useDashboardSdk`：

- SDK 会在 unmount 时尝试停止 auto refresh、dispose scheduler（isolate 场景）

## 5. 发布形态 smoke test（dist）

本仓库本地开发默认走源码 alias。建议定期验证 “真实发布形态”：

```bash
pnpm build
GF_USE_DIST=1 pnpm -C packages/app dev
```
