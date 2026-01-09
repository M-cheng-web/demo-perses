# @grafana-fast/component

内部 Dashboard 组件与 store 封装合集，支持通过 `/#/` 别名访问源码工具方法。

```bash
pnpm add @grafana-fast/component
```

> 组件包不再直接导出 `Dashboard`，请通过 `@grafana-fast/hooks` 中的 `useDashboardSdk` 将 Dashboard 挂载到你的容器节点。

组件包当前仅暴露一个占位按钮 `MockButton` 以及所有 store 导出：

```ts
import { MockButton, useDashboardStore } from '@grafana-fast/component';
```
