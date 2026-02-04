# @grafana-fast/store

`@grafana-fast/store` 是 grafana-fast 的状态管理基础设施，主要目标是支持「多实例 Dashboard 同页嵌入」的隔离能力。

特性概览：

- injected store 优先：避免依赖全局单例（对多 Vue App / 多 dashboard 场景更友好）
- 轻量 API：只暴露 grafana-fast runtime 所需的最小能力集合

## Installation

```bash
pnpm add @grafana-fast/store
```

## License

MIT
