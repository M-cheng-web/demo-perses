# @grafana-fast/dashboard

可嵌入式 Dashboard 引擎（渲染 + 编辑 + QueryBuilder + JSON 导入/导出），默认使用 `@grafana-fast/component` 作为 UI 基座。

## 安装

```bash
pnpm add @grafana-fast/dashboard
```

Peer dependencies（宿主应用需要提供）：

- `vue`
- `echarts`
- `@ant-design/icons-vue`

## 推荐用法：通过 SDK 挂载（最省心）

仓库内推荐入口在 `@grafana-fast/hooks`：

```ts
import { useDashboardSdk } from '@grafana-fast/hooks';

const sdk = useDashboardSdk(dashboardRef, {
  dashboardId: 'default',
  instanceId: 'my-dashboard-1',
  // apiClient / theme / readOnly 等…
});

sdk.actions.toolbar.viewJson();
```

优点：

- 自动处理 pinia 隔离、多实例销毁清理
- 对外提供“命令式 actions + 事件订阅 on/off + getState/getDashboardSnapshot 快照读取”的稳定 API 面

## 直接使用组件：DashboardView

```vue
<template>
  <DashboardView
    :instanceId="'my-dashboard-1'"
    theme="light"
    :portalTarget="portalTarget"
  />
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { DashboardView } from '@grafana-fast/dashboard';

  // 可选：把 Teleport 浮层挂到指定容器（增强隔离/便于销毁）
  const portalTarget = ref<HTMLElement | null>(null);
  onMounted(() => (portalTarget.value = document.body));
<\/script>
```

说明：

- `instanceId` 必须唯一（同页多实例隔离依赖它）
- `theme` 支持 `light/dark`
- `portalTarget` 用于控制 Modal/Drawer/Dropdown/Select 等 Teleport 浮层的挂载点（默认 `body`）

## 更多集成说明

查看 `packages/dashboard/INTEGRATION.md`。
