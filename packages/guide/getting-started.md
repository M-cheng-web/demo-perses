# 快速开始

本指南将帮助你快速上手 Grafana Fast。

## 安装

::: code-group
```bash [pnpm]
pnpm add @grafana-fast/hooks @grafana-fast/component
```

```bash [npm]
npm install @grafana-fast/hooks @grafana-fast/component
```

```bash [yarn]
yarn add @grafana-fast/hooks @grafana-fast/component
```
:::

## 基本使用

### 在 Vue 3 项目中使用

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

const { mount, unmount } = useDashboard({
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

### 在 React 项目中使用

```tsx
import { useRef, useEffect } from 'react'
import { useDashboard } from '@grafana-fast/hooks'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current) return
    
    const { mount, unmount } = useDashboard({
      container: containerRef.current,
      dashboard: {
        id: 'my-dashboard',
        title: 'My Dashboard'
      }
    })
    
    mount()
    
    return () => {
      unmount()
    }
  }, [])
  
  return (
    <div ref={containerRef} style={{ width: '100%', height: '600px' }} />
  )
}
```

### 在原生 JavaScript 中使用

```html
<!DOCTYPE html>
<html>
<head>
  <title>Grafana Fast Demo</title>
</head>
<body>
  <div id="dashboard-container" style="width: 100%; height: 600px"></div>
  
  <script type="module">
    import { useDashboard } from '@grafana-fast/hooks'
    
    const container = document.getElementById('dashboard-container')
    
    const { mount } = useDashboard({
      container,
      dashboard: {
        id: 'my-dashboard',
        title: 'My Dashboard'
      }
    })
    
    mount()
  </script>
</body>
</html>
```

## 配置仪表板

### 添加面板

```typescript
import { useDashboard } from '@grafana-fast/hooks'
import type { Dashboard } from '@grafana-fast/types'

const dashboard: Dashboard = {
  id: 'my-dashboard',
  title: 'My Dashboard',
  panelGroups: [
    {
      id: 'group-1',
      title: 'Group 1',
      panels: [
        {
          id: 'panel-1',
          title: 'Time Series Chart',
          type: 'time-series',
          gridPos: { x: 0, y: 0, w: 12, h: 8 }
        }
      ]
    }
  ]
}

const { mount } = useDashboard({
  container: containerRef,
  dashboard
})

mount()
```

### 动态更新配置

```typescript
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

### 控制时间范围

```typescript
const { mount, setTimeRange } = useDashboard({
  container: containerRef
})

mount()

// 设置时间范围为最近 1 小时
setTimeRange('now-1h', 'now')

// 设置时间范围为最近 24 小时
setTimeRange('now-24h', 'now')

// 设置自定义时间范围
setTimeRange('2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z')
```

### 刷新数据

```typescript
const { mount, refresh } = useDashboard({
  container: containerRef
})

mount()

// 刷新所有面板数据
refresh()

// 定时刷新
setInterval(() => {
  refresh()
}, 30000) // 每 30 秒刷新一次
```

## 类型支持

Grafana Fast 提供完整的 TypeScript 类型定义：

```typescript
import type {
  Dashboard,
  Panel,
  PanelGroup,
  Query,
  TimeRange,
  DataSource
} from '@grafana-fast/types'
```

## 下一步

- 查看 [useDashboard Hook 文档](/hooks/useDashboard/)
- 查看 [Dashboard 组件文档](/component/Dashboard/)
- 查看 [类型定义](/types/)
