# Dashboard 挂载

`@grafana-fast/component` 不再直接导出 Dashboard，请通过 `@grafana-fast/hooks` 暴露的 `useDashboardSdk` 将 Dashboard 渲染到你自己的容器中。

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';

const hostRef = ref<HTMLElement | null>(null);
useDashboardSdk(hostRef, { dashboardId: 'default' });
</script>

<template>
  <div ref="hostRef" style="min-height: 480px;"></div>
</template>
```

## 依赖要求

- 需要在宿主应用中注册 `@grafana-fast/store` 与 `Ant Design Vue`，并提供 `echarts`、`dayjs` 等 peer 依赖。
- 组件内部使用 `/#/` 别名访问源码，你也可以在本地通过 `vite.config.ts` 将 `/#/` 指向 `packages/component/src` 以获得类型提示。

## 导出内容

- 占位组件 `MockButton`。
- `useDashboardStore`、`useTimeRangeStore`、`useTooltipStore`、`useEditorStore` 等内部 store。
- 所有 `@grafana-fast/types` 类型。

组件入口会自动引入全局样式 `assets/styles/global.less`，无需在外部重复导入。
