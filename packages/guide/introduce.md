# 介绍

Grafana Fast 是一个基于 Vue 3 的现代化仪表板可视化库，旨在提供快速、灵活、易用的仪表板解决方案。

## 为什么选择 Grafana Fast？

### 🎯 简单易用

通过简单的 Hook 即可将仪表板集成到任何项目中，无需复杂的配置。

```typescript
import { useDashboard } from '@grafana-fast/hooks'

const { mount } = useDashboard({
  container: containerRef,
  dashboard: { /* ... */ }
})

mount()
```

### 🚀 快速集成

类似 ECharts 的集成方式，通过 ref 将仪表板挂载到任意 div，支持在 React、Vue、Angular 等任何框架中使用。

### 📦 模块化设计

采用 monorepo 架构，将功能拆分为多个子包：

- `@grafana-fast/hooks`: 核心 Hooks
- `@grafana-fast/component`: 可视化组件
- `@grafana-fast/types`: 类型定义

### 🎨 丰富的图表类型

支持多种图表类型：

- 时序图（Time Series）
- 柱状图（Bar Chart）
- 饼图（Pie Chart）
- 仪表盘（Gauge）
- 热力图（Heatmap）
- 表格（Table）
- 统计面板（Stat Panel）

### 🔧 完整的类型支持

提供完整的 TypeScript 类型定义，让开发更加顺畅。

```typescript
import type { Dashboard, Panel, Query } from '@grafana-fast/types'
```

### 🌈 现代化 UI

基于 Ant Design Vue，提供美观、易用的用户界面。

## 架构设计

Grafana Fast 采用 monorepo 架构，包含以下子包：

### @grafana-fast/hooks

核心 Hooks 包，提供 `useDashboard` 等核心功能。

**主要功能:**
- Dashboard 挂载和卸载
- 配置动态更新
- 时间范围控制
- 数据刷新

### @grafana-fast/component

组件包，包含所有可视化组件。

**主要组件:**
- Dashboard: 主仪表板组件
- Panel: 面板组件
- Charts: 各种图表组件
- QueryBuilder: 查询构建器

### @grafana-fast/types

类型定义包，提供完整的 TypeScript 类型定义。

**主要类型:**
- Dashboard
- Panel
- PanelGroup
- Query
- TimeRange
- DataSource

## 使用场景

Grafana Fast 适用于以下场景：

1. **监控仪表板**: 构建实时监控仪表板
2. **数据可视化**: 展示各种数据的可视化
3. **业务报表**: 创建业务报表和分析
4. **嵌入式仪表板**: 将仪表板嵌入到现有应用中

## 下一步

- [快速开始](/guide/getting-started)
- [useDashboard Hook](/hooks/useDashboard/)
- [Dashboard 组件](/component/Dashboard/)

