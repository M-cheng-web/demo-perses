# ListLegend 模式使用说明

## 📖 概述

ListLegend 是一种垂直列表式的图例显示模式，非常适合显示大量数据系列。与 Compact 模式的横向流式布局不同，ListLegend 以紧凑的列表形式展示所有系列，类似 Perses/Grafana 的列表图例。

---

## 🎯 Demo 示例

### 1. 内存详细监控面板

在 `demo-perses` 项目中，已经创建了一个使用 ListLegend 模式的示例面板：**"内存详细监控"**

**位置：** 内存监控组 → 第三个面板（占满整行）

**特点：**
- ✅ 显示 6 种内存类型（Apps、PageTables、SwapCache、Slab、Cache、Buffers）
- ✅ 使用 ListLegend 模式，纵向列表展示
- ✅ 面积图 + 堆叠模式
- ✅ 每个系列独立配色
- ✅ 支持点击切换系列可见性

---

## 🔧 如何配置 ListLegend 模式

### 基本配置

```typescript
const panel: Panel = {
  // ... 其他配置
  options: {
    legend: {
      show: true,
      mode: 'list',        // 关键：设置为 'list' 模式
      position: 'bottom',  // 位置：bottom 或 right
      size: 'medium',      // 尺寸：small 或 medium
    },
  },
};
```

### 完整示例

```typescript
import { createQuery } from '@/mock/panels';

export function createMemoryDetailsPanel(): Panel {
  return {
    id: uuidv4(),
    name: '内存详细监控',
    description: '显示各类内存使用情况',
    type: 'timeseries',
    
    // 多个查询，每个查询对应一个系列
    queries: [
      createQuery('memory_apps', 'Apps - Memory used by user-space applications'),
      createQuery('memory_pagetables', 'PageTables - Memory used to map...'),
      createQuery('memory_swapcache', 'SwapCache - Memory that keeps track...'),
      createQuery('memory_slab', 'Slab - Memory used by the kernel...'),
      createQuery('memory_cache', 'Cache - Parked file data cache'),
      createQuery('memory_buffers', 'Buffers - In-memory block I/O buffers'),
    ],
    
    options: {
      chart: {
        smooth: false,
        showSymbol: false,
        colors: [
          '#5470c6', // 蓝色 - Apps
          '#91cc75', // 绿色 - PageTables
          '#fac858', // 黄色 - SwapCache
          '#ee6666', // 红色 - Slab
          '#73c0de', // 青色 - Cache
          '#3ba272', // 深绿 - Buffers
        ],
      },
      legend: {
        show: true,
        mode: 'list',        // ⭐ 使用列表模式
        position: 'bottom',
      },
      format: {
        unit: 'bytes',
        decimals: 2,
      },
    },
  };
}
```

---

## 🎨 ListLegend vs CompactLegend

| 特性 | ListLegend | CompactLegend |
|------|-----------|---------------|
| **布局** | 垂直列表 | 横向流式 |
| **适用场景** | 多系列（>10） | 少量系列（<10） |
| **空间占用** | 纵向较高 | 横向较宽 |
| **可读性** | 长标签友好 | 短标签友好 |
| **滚动** | 支持垂直滚动 | 支持垂直滚动 |
| **自动切换** | >50 系列时自动使用 | <50 系列时默认 |

---

## 🔄 模式自动切换

Legend 组件会根据系列数量自动选择最佳模式：

```typescript
// Legend.vue 中的逻辑
const legendComponent = computed(() => {
  const mode = props.options.mode || 'compact';
  
  // 如果系列很多（>50），自动使用列表模式
  if (props.items.length > 50 && mode === 'compact') {
    return ListLegend;
  }
  
  return mode === 'list' ? ListLegend : CompactLegend;
});
```

---

## 💡 使用建议

### 何时使用 ListLegend？

✅ **推荐使用：**
- 系列数量 > 10
- 系列标签较长（如完整描述文本）
- 需要清晰的垂直排列
- 类似表格的展示需求

❌ **不推荐使用：**
- 系列数量 < 5
- 所有标签都很短
- 需要节省垂直空间

### 何时使用 CompactLegend？

✅ **推荐使用：**
- 系列数量 < 10
- 标签简短明了
- 需要横向紧凑布局
- 面板高度有限

---

## 🎯 样式特点

### ListLegend 样式

```less
.list-legend {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background-color: @background-light;
      }

      &.is-selected {
        background-color: fade(@primary-color, 10%);
        font-weight: 500;
      }

      .item-color {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .item-label {
        font-size: 12px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}
```

---

## 🚀 查看 Demo

### 启动项目

```bash
cd demo-perses
npm run dev
```

### 查看效果

1. 打开浏览器访问 `http://localhost:5173`
2. 找到 **"内存监控"** 面板组
3. 向下滚动到 **"内存详细监控"** 面板
4. 观察底部的 ListLegend 图例

### 交互测试

- ✅ **单击** Legend 项目 → 切换该系列的可见性
- ✅ **Shift/Ctrl + 单击** → 多选系列
- ✅ **悬停** Legend 项目 → 图表中对应系列高亮
- ✅ **滚动** → 当系列很多时支持垂直滚动

---

## 📊 数据源配置

### Mock 数据

在 `src/api/prometheus.ts` 中，为新的内存查询添加了 mock 支持：

```typescript
function generateMockMetrics(query: string): Array<Record<string, string>> {
  if (query === 'memory_apps') {
    return [{ __name__: 'memory_apps', type: 'apps' }];
  } else if (query === 'memory_pagetables') {
    return [{ __name__: 'memory_pagetables', type: 'pagetables' }];
  }
  // ... 其他内存类型
}
```

### 自定义数据

要使用真实的 Prometheus 数据源，只需修改查询表达式：

```typescript
queries: [
  createQuery('node_memory_Apps_bytes', 'Apps'),
  createQuery('node_memory_PageTables_bytes', 'PageTables'),
  createQuery('node_memory_SwapCached_bytes', 'SwapCache'),
  createQuery('node_memory_Slab_bytes', 'Slab'),
  createQuery('node_memory_Cached_bytes', 'Cache'),
  createQuery('node_memory_Buffers_bytes', 'Buffers'),
]
```

---

## 🎓 扩展示例

### 示例 1：系统资源监控

```typescript
export function createSystemResourcesPanel(): Panel {
  return {
    name: '系统资源全景',
    type: 'timeseries',
    queries: [
      createQuery('cpu_total', 'CPU Total'),
      createQuery('memory_total', 'Memory Total'),
      createQuery('disk_io_read', 'Disk Read'),
      createQuery('disk_io_write', 'Disk Write'),
      createQuery('network_rx', 'Network RX'),
      createQuery('network_tx', 'Network TX'),
      createQuery('swap_used', 'Swap Used'),
      createQuery('file_descriptors', 'File Descriptors'),
    ],
    options: {
      legend: {
        show: true,
        mode: 'list',
        position: 'right', // 右侧展示
      },
    },
  };
}
```

### 示例 2：容器资源监控

```typescript
export function createContainerResourcesPanel(): Panel {
  return {
    name: '容器资源使用',
    type: 'timeseries',
    queries: [
      createQuery('container_cpu{name=~".+"}', '{{name}} - CPU'),
      createQuery('container_memory{name=~".+"}', '{{name}} - Memory'),
    ],
    options: {
      legend: {
        show: true,
        mode: 'list', // 多容器时使用列表模式
        position: 'bottom',
      },
    },
  };
}
```

---

## 🔍 Perses 对照

### Perses 中的 ListLegend

Perses 项目的 ListLegend 实现位于：
```
perses/ui/components/src/Legend/ListLegend.tsx
```

**核心特性（已移植）：**
- ✅ 垂直列表布局
- ✅ 颜色方块 + 标签
- ✅ 点击切换可见性
- ✅ 悬停高亮
- ✅ 选中状态视觉反馈
- ✅ 滚动支持

---

## 📝 总结

**ListLegend 模式已完整实现，包括：**

1. ✅ ListLegend 组件（`src/components/ChartLegend/ListLegend.vue`）
2. ✅ 自动模式切换逻辑
3. ✅ Demo 示例面板（内存详细监控）
4. ✅ Mock 数据支持
5. ✅ 完整的交互功能
6. ✅ 响应式样式

**立即体验：**
```bash
npm run dev
# 访问 http://localhost:5173
# 找到"内存监控" → "内存详细监控"面板
```

🎉 **ListLegend 模式已就绪，享受更好的多系列数据可视化体验！**

