---
category: Components
---

# Dashboard

主仪表板组件，用于展示和管理面板组。

## 基本用法

```vue
<template>
  <Dashboard />
</template>

<script setup lang="ts">
import { Dashboard } from '@grafana-fast/component'
</script>
```

## 特性

- ✅ 响应式布局
- ✅ 可视化编辑
- ✅ 多种图表类型
- ✅ 实时数据更新
- ✅ 时间范围选择
- ✅ 全局 Tooltip
- ✅ 面板全屏查看

## 组件结构

- **DashboardToolbar**: 工具栏，包含时间范围选择、编辑模式切换等
- **PanelGroupList**: 面板组列表
- **PanelEditorDrawer**: 面板编辑器抽屉
- **PanelFullscreenModal**: 面板全屏查看模态框
- **GlobalChartTooltip**: 全局图表 Tooltip
- **PanelGroupDialog**: 面板组编辑对话框

## 相关类型

```ts
import type { Dashboard, PanelGroup, Panel } from '@grafana-fast/types'
```
