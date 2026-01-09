# Dashboard 组件

`@grafana-fast/component` 暴露的 `Dashboard` 组件聚合了查询、布局、Tooltip、面板编辑等能力。

```vue
<script setup lang="ts">
import { Dashboard } from '@grafana-fast/component';
</script>

<template>
  <Dashboard />
</template>
```

## 依赖要求

- 需要在宿主应用中注册 `Pinia` 与 `Ant Design Vue`，并提供 `echarts`、`dayjs`、`ant-design-vue`、`pinia` 作为 peer 依赖。
- 组件内部使用 `/#/` 别名访问源码，你也可以在本地通过 `vite.config.ts` 将 `/#/` 指向 `packages/component/src` 以获得类型提示。

## 导出内容

- `Dashboard` 组件（默认导出）。
- `useDashboardStore`、`useTimeRangeStore`、`useTooltipStore`、`useEditorStore` 等内部 store。
- 所有 `@grafana-fast/types` 类型。

组件入口会自动引入全局样式 `assets/styles/global.less`，无需在外部重复导入。
