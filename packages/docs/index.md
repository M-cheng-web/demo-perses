# Grafana Fast

一个基于 Vue 3 的仪表盘 monorepo，包含可复用的 Dashboard 组件、hook SDK 以及类型定义。

- `@grafana-fast/component`：UI 组件库（Design Tokens + 基础组件）。
- `@grafana-fast/dashboard`：Dashboard 视图与内部状态（stores/composables）。
- `@grafana-fast/hooks`：SDK 接入层（在业务容器中挂载 Dashboard）。
- `@grafana-fast/types`：对外暴露的类型与枚举。
- `packages/docs`：VitePress 文档与示例。
- `packages/app`：演示站点，消费这些发布包。

使用 pnpm 工作区运行开发环境：

```bash
pnpm install
pnpm dev
```
