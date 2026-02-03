# Dashboard SDK

`@grafana-fast/hooks` 提供 `useDashboardSdk`，用于在任意组件中驱动 Dashboard 与 Pinia 状态。

更完整的接入方式与最佳实践请参考：`/sdk/dashboard-sdk-usage`。

关于“dashboardId（资源标识）与 Dashboard JSON（内容）如何拆分、以及新/老用户/导入 JSON 的完整流程”，请参考：`/sdk/dashboard-sdk-plan-a`。

## 快速示例

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useDashboardSdk } from '@grafana-fast/hooks';

const root = ref<HTMLElement | null>(null);
const { on, getState, getApiConfig } = useDashboardSdk(root, {
  dashboardId: 'default',
  apiConfig: {
    baseUrl: 'https://api.example.com',
  },
});

const state = ref(getState());
on('change', ({ state: next }) => {
  state.value = next;
});

const api = getApiConfig();
</script>

<template>
  <div>
    <div ref="root" style="min-height: 480px;"></div>
    <aside v-if="state.dashboard">
      <p>面板组数量：{{ state.dashboard.groupCount }}</p>
      <p>容器尺寸：{{ state.containerSize.width }} × {{ state.containerSize.height }}</p>
      <p>加载接口：{{ api.endpoints.LoadDashboard }}</p>
    </aside>
  </div>
</template>
```

## 返回值

- `getState()`：获取当前**轻量快照**（不会泄漏内部引用，外部修改不会影响内部）。
- `getDashboardSnapshot()`：获取当前 dashboard JSON 的**深拷贝**（可能较大，按需调用）。
- `on/off`：事件总线订阅（例如 `change` / `error`）。
- `getApiConfig()`：获取解析后的 API 配置（baseUrl + endpoints 完整 URL）。
- `actions`：封装的命令式操作集合（加载/保存、增删改面板组、时间范围、主题、只读开关等）。

## 接口枚举

通过 `DashboardApi` 与 `DEFAULT_DASHBOARD_ENDPOINTS` 获取或自定义接口路径：

```ts
import { DashboardApi, DEFAULT_DASHBOARD_ENDPOINTS } from '@grafana-fast/hooks';

const custom = {
  ...DEFAULT_DASHBOARD_ENDPOINTS,
  [DashboardApi.ExecuteQueries]: '/custom/queries',
};
```

## 别名说明

- `@grafana-fast/types`：统一暴露所有类型/枚举，可在业务中直接引用。
- `/#/`：dashboard 包内部的源码别名（仅供包内使用），外部应用不建议依赖它。
