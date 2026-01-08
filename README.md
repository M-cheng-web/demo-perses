# Grafana Fast

基于 Vue 3 的现代化仪表板可视化库，采用 monorepo 架构。

## ✨ 特性

- 🚀 **快速集成**: 通过简单的 Hook 即可将仪表板集成到任何项目中
- 🎨 **丰富的图表类型**: 支持时序图、柱状图、饼图、仪表盘等多种图表类型
- 📊 **实时数据**: 支持实时数据更新，轻松构建动态仪表板
- 🔧 **灵活配置**: 提供完整的 TypeScript 类型定义，配置更灵活
- 🌈 **现代化 UI**: 基于 Ant Design Vue，提供美观的用户界面
- ⚡️ **高性能**: 基于 ECharts 和 Vue 3，性能卓越

## 📦 包结构

```
@grafana-fast/
├── @grafana-fast/component   # 可视化组件
├── @grafana-fast/hooks        # 核心 Hooks
├── @grafana-fast/types        # 类型定义
└── @grafana-fast/metadata     # 元数据
```

## 🚀 快速开始

### 安装

```bash
pnpm add @grafana-fast/hooks @grafana-fast/component
```

### 使用

```vue
<template>
  <div>
    <button @click="mount">挂载 Dashboard</button>
    <div ref="containerRef" style="width: 100%; height: 600px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDashboard } from '@grafana-fast/hooks'

const containerRef = ref<HTMLElement>()

const { mount } = useDashboard({
  container: containerRef,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard'
  }
})
</script>
```

## 🏗️ 项目结构

```
demo-perses/
├── packages/                   # Monorepo 子包
│   ├── component/             # 组件包
│   │   ├── Dashboard/         # Dashboard 组件
│   │   ├── Charts/            # 图表组件
│   │   ├── Panel/             # 面板组件
│   │   └── ...
│   ├── hooks/                 # Hooks 包
│   │   └── useDashboard/      # 核心 Hook
│   ├── types/                 # 类型定义包
│   ├── metadata/              # 元数据包
│   ├── .vitepress/            # 文档系统
│   ├── guide/                 # 文档指南
│   └── index.md               # 文档首页
├── playground/                # 开发测试环境
├── scripts/                   # 构建脚本
├── meta/                      # 包配置
└── pnpm-workspace.yaml        # Workspace 配置
```

## 📝 开发

### 安装依赖

```bash
pnpm install
```

### 启动文档

```bash
pnpm run docs
```

### 启动 Playground

```bash
pnpm run playground
```

### 构建

```bash
pnpm run build
```

### 发布

```bash
pnpm run publish
```

## 📚 文档

查看 [完整文档](https://grafana-fast.com) 了解更多信息。

## 🔗 相关链接

- [快速开始](./packages/guide/getting-started.md)
- [useDashboard Hook](./packages/hooks/useDashboard/index.md)
- [Dashboard 组件](./packages/component/Dashboard/index.md)

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](./CONTRIBUTING.md)。

## 📄 License

[MIT](./LICENSE)

## 🎯 设计理念

Grafana Fast 的设计理念是让仪表板集成像使用 ECharts 一样简单：

1. **通过 ref 挂载**: 传入一个 ref 或 HTMLElement，即可将仪表板挂载到指定容器
2. **独立运行**: 所有 UI 交互（弹窗、Toast 等）都绑定在挂载的容器内
3. **框架无关**: 可以在任何框架（Vue、React、Angular）中使用
4. **完整功能**: 包含完整的仪表板功能，无需额外配置

## 💡 使用示例

### 在 React 中使用

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
    
    return () => unmount()
  }, [])
  
  return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />
}
```

### 在原生 JavaScript 中使用

```html
<!DOCTYPE html>
<html>
<body>
  <div id="container" style="width: 100%; height: 600px"></div>
  
  <script type="module">
    import { useDashboard } from '@grafana-fast/hooks'
    
    const { mount } = useDashboard({
      container: document.getElementById('container'),
      dashboard: { id: 'my-dashboard', title: 'My Dashboard' }
    })
    
    mount()
  </script>
</body>
</html>
```

## 🔧 核心 API

### useDashboard

核心 Hook，用于将 Dashboard 组件挂载到指定的 DOM 元素上。

```typescript
interface UseDashboardOptions {
  container: HTMLElement | Ref<HTMLElement | undefined>
  dashboard?: Dashboard
  onMounted?: () => void
  onUnmounted?: () => void
}

interface UseDashboardReturn {
  app: VueApp | null
  mount: () => void
  unmount: () => void
  updateDashboard: (config: Partial<Dashboard>) => void
  getDashboard: () => Dashboard | null
  setTimeRange: (from: string, to: string) => void
  refresh: () => void
  isMounted: Ref<boolean>
}
```

## 📊 支持的图表类型

- **Time Series Chart**: 时序图
- **Bar Chart**: 柱状图
- **Pie Chart**: 饼图
- **Gauge Chart**: 仪表盘
- **Heatmap Chart**: 热力图
- **Table Chart**: 表格
- **Stat Panel**: 统计面板

## 🎨 主题定制

Grafana Fast 基于 Ant Design Vue，支持主题定制。

```typescript
import { ConfigProvider } from 'ant-design-vue'

// 自定义主题
const theme = {
  token: {
    colorPrimary: '#1890ff',
    // ...
  }
}
```

## 📦 Monorepo 架构

本项目采用 monorepo 架构，使用 pnpm workspace 管理。

### 子包说明

#### @grafana-fast/component

可视化组件包，包含：
- Dashboard: 主仪表板组件
- Panel: 面板组件
- Charts: 各种图表组件
- QueryBuilder: 查询构建器

#### @grafana-fast/hooks

核心 Hooks 包，包含：
- useDashboard: 核心 Hook，用于挂载和管理仪表板

#### @grafana-fast/types

类型定义包，包含：
- Dashboard: 仪表板类型
- Panel: 面板类型
- Query: 查询类型
- TimeRange: 时间范围类型

#### @grafana-fast/metadata

元数据包，用于管理包信息和文档生成。

## 🛠️ 开发工具链

- **构建工具**: Vite + Rollup
- **类型检查**: TypeScript
- **代码规范**: ESLint + Prettier
- **文档系统**: VitePress
- **包管理**: pnpm
- **UI 框架**: Ant Design Vue
- **图表库**: ECharts
- **状态管理**: Pinia

## 🔄 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本更新信息。
