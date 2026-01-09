# Grafana Fast

一个基于 Vue 3 的仪表盘 monorepo，包含可复用的 Dashboard 组件、hook SDK 以及类型定义。

- `@grafana-fast/component`：封装 Dashboard 组件与内部状态。
- `@grafana-fast/hooks`：为外部应用提供可组合的 SDK 接入层。
- `@grafana-fast/types`：对外暴露的类型与枚举。
- `packages/docs`：VitePress 文档与示例。
- `packages/app`：演示站点，消费组件与 hooks。

使用 pnpm 工作区运行开发环境：

```bash
pnpm install
pnpm dev
```
