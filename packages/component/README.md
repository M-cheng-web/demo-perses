# @grafana-fast/component

Dashboard 组件与内部 Pinia store 的合集，支持通过 `/#/` 别名访问源码工具方法。

```bash
pnpm add @grafana-fast/component
```

```vue
<script setup lang="ts">
import { Dashboard } from '@grafana-fast/component';
</script>

<template>
  <Dashboard />
</template>
```

在宿主应用中请确保已注册 `pinia` 与 `ant-design-vue`，并提供 `echarts`、`dayjs` 等 peer 依赖。
