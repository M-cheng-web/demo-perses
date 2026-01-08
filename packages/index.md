---
layout: home

hero:
  name: Grafana Fast
  text: 快速仪表板可视化库
  tagline: 基于 Vue 3 的现代化仪表板解决方案
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/grafana-fast/grafana-fast

features:
  - icon: 🚀
    title: 快速集成
    details: 通过简单的 Hook 即可将仪表板集成到任何项目中
  - icon: 🎨
    title: 丰富的图表类型
    details: 支持时序图、柱状图、饼图、仪表盘等多种图表类型
  - icon: 📊
    title: 实时数据
    details: 支持实时数据更新，轻松构建动态仪表板
  - icon: 🔧
    title: 灵活配置
    details: 提供完整的 TypeScript 类型定义，配置更灵活
  - icon: 🌈
    title: 现代化 UI
    details: 基于 Ant Design Vue，提供美观的用户界面
  - icon: ⚡️
    title: 高性能
    details: 基于 ECharts 和 Vue 3，性能卓越
---

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

## 快速开始

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

## 特性

- ✅ **通过 Ref 挂载**: 类似 ECharts，通过 ref 将仪表板挂载到任意 div
- ✅ **完整的组件库**: 包含 Dashboard、Panel、Chart 等完整组件
- ✅ **TypeScript 支持**: 完整的类型定义
- ✅ **Hooks 集成**: 提供 useDashboard 等核心 Hooks
- ✅ **第三方组件库支持**: 内置 Ant Design Vue、ECharts 等
- ✅ **弹窗、Toast 等**: 所有 UI 交互都绑定在挂载的容器内

## License

[MIT](https://github.com/grafana-fast/grafana-fast/blob/main/LICENSE)
