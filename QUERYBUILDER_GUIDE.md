# QueryBuilder 使用指南

本仓库的 QueryBuilder 位于 `@grafana-fast/dashboard` 包中，用于在面板编辑器里以可视化方式构建 PromQL。

> 说明：目前仓库更偏“演示/组件化封装”，QueryBuilder 的 API 以组件内部交互为主；对外更推荐通过 `@grafana-fast/hooks` 的 `useDashboardSdk` 挂载整个 Dashboard 体验。

## 功能概览

- 可视化构建 PromQL：指标选择、标签过滤、操作链管理（聚合/函数/范围/数学等）
- 实时预览 PromQL 与结果（结合 mock/真实接口）
- 查询提示（hints）与解释（explain）
- 预设模板（patterns）快速开始

## 入口与代码位置

- 组件入口：`packages/dashboard/src/components/QueryBuilder`
- 查询相关 API：`packages/dashboard/src/api/querybuilder`

## 宿主应用如何启用

1. 安装并引入依赖（在 monorepo 内可直接运行 demo）：

```bash
pnpm install
pnpm dev
```

2. 在 Dashboard 中打开“面板编辑器 → 数据查询”即可使用 QueryBuilder。

## 对接真实 Prometheus

目前 demo 默认使用 mock 数据。要对接真实 Prometheus API，可从这里入手：

- `packages/dashboard/src/api/querybuilder/prometheusApi.ts`

将其中的 mock 实现替换为真实的 Prometheus HTTP API 调用即可。

