# @grafana-fast/api

`@grafana-fast/api` 提供 grafana-fast 的 API 合同层（contracts）与实现层（impl），用于在宿主应用与 dashboard runtime 之间建立稳定接口。

典型用途：

- 宿主应用注入 `GrafanaFastApiClient`，UI 侧只依赖接口而不是具体后端
- 开发阶段使用 mock 实现快速跑通交互与查询链路

## Installation

```bash
pnpm add @grafana-fast/api
```

## License

MIT
