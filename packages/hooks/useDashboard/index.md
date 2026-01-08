---
category: Hooks
---

# useDashboard

核心 Hook，用于将 Dashboard 组件挂载到指定的 DOM 元素上，支持动态配置和数据刷新。

## 基本用法

```vue
<template>
  <div>
    <button @click="handleMount">挂载 Dashboard</button>
    <button @click="handleUnmount">卸载 Dashboard</button>
    <div ref="containerRef" style="width: 100%; height: 600px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDashboard } from '@grafana-fast/hooks'

const containerRef = ref<HTMLElement>()

const { mount, unmount, updateDashboard } = useDashboard({
  container: containerRef,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard',
    panels: []
  }
})

const handleMount = () => {
  mount()
}

const handleUnmount = () => {
  unmount()
}
</script>
```

## 传入 HTMLElement

也可以直接传入 HTMLElement：

```ts
const container = document.getElementById('dashboard-container')

const { mount, unmount } = useDashboard({
  container: container!,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard'
  }
})

mount()
```

## 动态更新配置

```ts
const { mount, updateDashboard } = useDashboard({
  container: containerRef,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard'
  }
})

mount()

// 更新标题
updateDashboard({ title: 'New Dashboard Title' })
```

## 时间范围控制

```ts
const { mount, setTimeRange } = useDashboard({
  container: containerRef
})

mount()

// 设置时间范围为最近 1 小时
setTimeRange('now-1h', 'now')
```

## 刷新数据

```ts
const { mount, refresh } = useDashboard({
  container: containerRef
})

mount()

// 刷新所有面板数据
refresh()
```

## 类型定义

```ts
interface UseDashboardOptions {
  container: HTMLElement | Ref<HTMLElement | undefined>
  dashboard?: DashboardConfig
  onMounted?: () => void
  onUnmounted?: () => void
}

interface UseDashboardReturn {
  app: VueApp | null
  mount: () => void
  unmount: () => void
  updateDashboard: (config: Partial<DashboardConfig>) => void
  getDashboard: () => DashboardConfig | null
  setTimeRange: (from: string, to: string) => void
  refresh: () => void
  isMounted: Ref<boolean>
}
```

## 参数

| 参数 | 说明 | 类型 | 必填 |
| --- | --- | --- | --- |
| container | 挂载容器元素 | `HTMLElement \| Ref<HTMLElement>` | 是 |
| dashboard | 初始仪表板配置 | `DashboardConfig` | 否 |
| onMounted | 挂载完成回调 | `() => void` | 否 |
| onUnmounted | 卸载回调 | `() => void` | 否 |

## 返回值

| 属性 | 说明 | 类型 |
| --- | --- | --- |
| app | Vue 应用实例 | `VueApp \| null` |
| mount | 挂载仪表板 | `() => void` |
| unmount | 卸载仪表板 | `() => void` |
| updateDashboard | 更新仪表板配置 | `(config: Partial<DashboardConfig>) => void` |
| getDashboard | 获取当前仪表板配置 | `() => DashboardConfig \| null` |
| setTimeRange | 设置时间范围 | `(from: string, to: string) => void` |
| refresh | 刷新数据 | `() => void` |
| isMounted | 是否已挂载 | `Ref<boolean>` |
