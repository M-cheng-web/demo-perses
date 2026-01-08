# @grafana-fast/hooks

核心 Hooks，用于 Dashboard 挂载和管理。

## 安装

```bash
npm install @grafana-fast/hooks
```

## 使用

```typescript
import { useDashboard } from '@grafana-fast/hooks'

const { mount, unmount } = useDashboard({
  container: containerRef,
  dashboard: {
    id: 'my-dashboard',
    title: 'My Dashboard'
  }
})

mount()
```

## 主要 Hooks

### useDashboard

核心 Hook，用于将 Dashboard 组件挂载到指定的 DOM 元素上。

**特性:**
- ✅ 支持 Ref 和 HTMLElement
- ✅ 动态配置更新
- ✅ 时间范围控制
- ✅ 数据刷新
- ✅ 完整的生命周期回调

查看 [完整文档](./useDashboard/index.md)

## License

MIT
