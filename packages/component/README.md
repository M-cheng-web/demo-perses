# @grafana-fast/component

Dashboard 可视化组件库。

## 安装

```bash
npm install @grafana-fast/component
```

## 使用

### 直接使用组件

```vue
<template>
  <Dashboard />
</template>

<script setup lang="ts">
import { Dashboard } from '@grafana-fast/component'
import '@grafana-fast/component/index.css'
</script>
```

### 通过 Hook 使用（推荐）

```typescript
import { useDashboard } from '@grafana-fast/hooks'

const { mount } = useDashboard({
  container: containerRef,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard'
  }
})

mount()
```

## 组件列表

### Dashboard

主仪表板组件，包含完整的仪表板功能。

### Charts

- **TimeSeriesChart**: 时序图
- **BarChart**: 柱状图
- **PieChart**: 饼图
- **GaugeChart**: 仪表盘
- **HeatmapChart**: 热力图
- **TableChart**: 表格
- **StatPanel**: 统计面板

### Other Components

- **PanelGroup**: 面板组
- **Panel**: 面板
- **PanelEditor**: 面板编辑器
- **QueryBuilder**: 查询构建器
- **ChartLegend**: 图表图例
- **ChartTooltip**: 图表提示

## License

MIT
