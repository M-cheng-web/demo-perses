# Dashboard SDK

`@grafana-fast/hooks` 提供 `useDashboardSdk`，用于在任意组件中驱动 Dashboard 与 Pinia 状态。

## 快速示例

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Dashboard } from '@grafana-fast/component';
import { useDashboardSdk } from '@grafana-fast/hooks';

const root = ref<HTMLElement | null>(null);
const { state, actions, containerSize } = useDashboardSdk(root, {
  dashboardId: 'default',
});
</script>

<template>
  <section ref="root">
    <Dashboard />
    <aside v-if="state.dashboard">
      <p>面板组数量：{{ state.panelGroups.length }}</p>
      <p>当前模式：{{ state.isEditMode ? '编辑' : '浏览' }}</p>
      <p>容器尺寸：{{ containerSize.width }} × {{ containerSize.height }}</p>
      <button @click="actions.toggleEditMode">切换模式</button>
    </aside>
  </section>
</template>
```

## 返回值

- `state`：包含 `dashboard`、`panelGroups`、`viewPanel`、`timeRange`、`tooltip` 等核心状态（自动解包为 `computed`）。
- `actions`：封装的操作集合（加载/保存 dashboard、增删改面板组、调整布局、时间范围、Tooltip 注册等）。
- `containerSize`：跟踪传入 `ref` 的容器尺寸，便于外部布局计算。
- `ready`：hook 初始化完成的标记。
- `targetRef`：透传的容器 `ref`，内部已绑定鼠标事件用于 Tooltip 全局坐标。

## 别名说明

- `/#/`：组件包内部使用的绝对路径别名，已在 Vite 与 TS 中配置。
- `@grafana-fast/types`：统一暴露所有类型/枚举，可在业务中直接引用。
