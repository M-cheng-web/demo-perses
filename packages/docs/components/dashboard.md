# Dashboard 挂载

推荐通过 `@grafana-fast/hooks` 暴露的 `useDashboardSdk` 将 Dashboard 渲染到你自己的容器中（它会处理 Pinia、挂载/卸载与常用动作封装）。

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

- 使用 `useDashboardSdk` 时：
  - SDK 会创建一个**隔离的 pinia 实例**并用内部 `createApp()` 挂载 Dashboard
  - 宿主无需手动在自己的 Vue app 上安装 Pinia（也不会污染宿主的 store）
- 直接使用 `DashboardView` 组件时：
  - 宿主需要自行提供 Pinia（并确保组件树内注入 pinia），否则内部 store 无法工作
- `@grafana-fast/dashboard` / `@grafana-fast/hooks` 的 `peerDependencies` 需要由宿主提供（例如 `vue`、`echarts`）。
- `/#/` 是 **dashboard 包内部** 的源码绝对路径别名，不建议在业务侧或其它包中使用。

## 导出内容

- `@grafana-fast/dashboard`：
  - `DashboardView`（Dashboard 主视图组件）
  - `install(app)`（可选：注册 `GrafanaFastDashboard` 组件）
  - `useDashboardStore`、`useTimeRangeStore`、`useTooltipStore`、`useEditorStore` 等内部 stores
  - `@grafana-fast/types` 的全部类型/枚举

组件入口会自动引入全局样式 `assets/styles/global.less`，无需在外部重复导入。
