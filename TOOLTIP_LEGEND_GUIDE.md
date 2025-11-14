# 自定义 Tooltip 和 Legend 实现指南

## ✅ 已完成的基础工作

### 1. 类型定义
- ✅ `/src/types/legend.ts` - Legend 相关类型
  - `LegendMode`, `LegendPosition`, `LegendSize`
  - `LegendItem`, `LegendSelection`

### 2. Composables
- ✅ `/src/composables/useMousePosition.ts` - 鼠标位置追踪
- ✅ `/src/composables/useSeriesSelection.ts` - 系列选中管理

## 🎯 接下来的实现步骤

### 步骤 1：创建 Tooltip 组件（高优先级）

#### 1.1 创建 `ChartTooltip.vue`

```vue
<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="tooltipRef"
      class="chart-tooltip"
      :class="{ 'is-pinned': isPinned }"
      :style="tooltipStyle"
    >
      <div class="tooltip-header">
        <span class="tooltip-time">{{ formattedTime }}</span>
        <div class="tooltip-actions">
          <a-button
            v-if="isPinned"
            type="text"
            size="small"
            @click="handleUnpin"
          >
            <PushpinFilled />
          </a-button>
          <span v-else class="tooltip-hint">点击图表固定</span>
        </div>
      </div>
      <div class="tooltip-content">
        <div
          v-for="series in nearbySeries"
          :key="series.id"
          class="tooltip-series-item"
        >
          <span class="series-color" :style="{ backgroundColor: series.color }"></span>
          <span class="series-label">{{ series.label }}</span>
          <span class="series-value">{{ formatValue(series.value) }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PushpinFilled } from '@ant-design/icons-vue';
import type { ECharts } from 'echarts';
import { useMousePosition } from '@/composables/useMousePosition';
import { formatValue as formatVal, formatTime } from '@/utils';

interface Props {
  chartInstance: ECharts | null;
  data: any[];
  enablePinning?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enablePinning: true,
});

const emit = defineEmits<{
  (e: 'pin', position: { x: number; y: number }): void;
  (e: 'unpin'): void;
}>();

const mousePos = useMousePosition();
const tooltipRef = ref<HTMLElement>();
const isPinned = ref(false);
const pinnedPos = ref<{ x: number; y: number } | null>(null);
const nearbySeries = ref<any[]>([]);
const currentTime = ref<number>(0);

// 检查鼠标是否在图表区域
const isMouseOverChart = computed(() => {
  if (!mousePos.value) return false;
  const target = mousePos.value.target as HTMLElement;
  return target?.tagName === 'CANVAS';
});

// Tooltip 是否可见
const isVisible = computed(() => {
  return (isPinned.value || isMouseOverChart.value) && nearbySeries.value.length > 0;
});

// 格式化时间
const formattedTime = computed(() => {
  return formatTime(currentTime.value, 'YYYY-MM-DD HH:mm:ss');
});

// Tooltip 定位
const tooltipStyle = computed(() => {
  const pos = isPinned.value && pinnedPos.value ? pinnedPos.value : mousePos.value;
  if (!pos) return {};

  const padding = 16;
  let x = pos.pageX + padding;
  let y = pos.pageY + padding;

  // 确保不超出屏幕
  if (tooltipRef.value) {
    const rect = tooltipRef.value.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      x = pos.pageX - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight) {
      y = pos.pageY - rect.height - padding;
    }
  }

  return {
    transform: `translate3d(${x}px, ${y}px, 0)`,
  };
});

// 查找附近的系列数据
const findNearbySeries = () => {
  if (!props.chartInstance || !mousePos.value) {
    nearbySeries.value = [];
    return;
  }

  // 获取鼠标在图表中的像素坐标
  const pointInPixel = [mousePos.value.x, mousePos.value.y];
  
  // 转换为图表数据坐标
  const pointInGrid = props.chartInstance.convertFromPixel({ seriesIndex: 0 }, pointInPixel);
  
  if (!pointInGrid) {
    nearbySeries.value = [];
    return;
  }

  const [xValue] = pointInGrid;
  currentTime.value = xValue;

  // 查找该时间点的所有系列数据
  const series: any[] = [];
  props.data.forEach((timeSeries, index) => {
    // 找到最接近的时间点
    const closestPoint = timeSeries.values.find(([timestamp]: [number, number]) => {
      return Math.abs(timestamp - xValue) < 30000; // 30 秒容差
    });

    if (closestPoint) {
      const option = props.chartInstance!.getOption();
      const seriesOption = option.series?.[index] as any;
      
      series.push({
        id: timeSeries.metric.__name__ || `series-${index}`,
        label: timeSeries.metric.__legend__ || timeSeries.metric.__name__ || `Series ${index + 1}`,
        color: seriesOption?.lineStyle?.color || seriesOption?.itemStyle?.color || '#5470c6',
        value: closestPoint[1],
      });
    }
  });

  nearbySeries.value = series;
};

// 监听鼠标移动
watch(mousePos, () => {
  if (!isPinned.value) {
    findNearbySeries();
  }
}, { deep: true });

// 处理图表点击（固定 tooltip）
const handleChartClick = (event: MouseEvent) => {
  if (!props.enablePinning) return;

  if (isPinned.value) {
    handleUnpin();
  } else {
    isPinned.value = true;
    pinnedPos.value = {
      x: event.pageX,
      y: event.pageY,
    };
    emit('pin', pinnedPos.value);
  }
};

// 取消固定
const handleUnpin = () => {
  isPinned.value = false;
  pinnedPos.value = null;
  emit('unpin');
};

// 暴露方法供父组件使用
defineExpose({
  handleChartClick,
});
</script>

<style scoped lang="less">
.chart-tooltip {
  position: fixed;
  top: 0;
  left: 0;
  min-width: 200px;
  max-width: 400px;
  background-color: rgba(50, 50, 50, 0.95);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &.is-pinned {
    pointer-events: auto;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .tooltip-time {
      font-weight: 500;
    }

    .tooltip-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .tooltip-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }

      :deep(.ant-btn) {
        color: #fff;
        padding: 0;
        width: 24px;
        height: 24px;

        &:hover {
          color: @primary-color;
        }
      }
    }
  }

  .tooltip-content {
    padding: 8px 12px;
    max-height: 300px;
    overflow-y: auto;

    .tooltip-series-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;

      .series-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .series-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .series-value {
        font-weight: 600;
        font-family: monospace;
      }
    }
  }
}
</style>
```

#### 1.2 在 `TimeSeriesChart.vue` 中集成

```vue
<template>
  <div ref="chartRef" class="time-series-chart" @click="handleChartClick">
    <!-- 现有图表内容 -->
    
    <!-- 添加自定义 Tooltip -->
    <ChartTooltip
      ref="tooltipRef"
      :chart-instance="chartInstance"
      :data="props.queryResults.flatMap(r => r.data)"
      :enable-pinning="true"
    />
  </div>
</template>

<script setup lang="ts">
// ... 现有导入
import ChartTooltip from '@/components/ChartTooltip/ChartTooltip.vue';

// ... 现有代码

const tooltipRef = ref();

const handleChartClick = (event: MouseEvent) => {
  tooltipRef.value?.handleChartClick(event);
};

// 禁用 ECharts 原生 tooltip
const updateChart = () => {
  if (!chartInstance.value) return;

  const option = getChartOption();
  // 禁用原生 tooltip
  option.tooltip = { show: false };
  
  chartInstance.value.setOption(option, true);
};
</script>
```

### 步骤 2：创建 Legend 组件

#### 2.1 创建 `CompactLegend.vue`（Tag 标签模式）

```vue
<template>
  <div class="compact-legend">
    <div class="legend-items">
      <div
        v-for="item in items"
        :key="item.id"
        class="legend-item"
        :class="{ 'is-selected': isSelected(item.id), 'is-dimmed': !isSelected(item.id) && hasSelection }"
        @click="handleClick($event, item.id)"
        @mouseenter="emit('itemHover', item.id)"
        @mouseleave="emit('itemLeave', item.id)"
      >
        <span class="item-color" :style="{ backgroundColor: item.color }"></span>
        <span class="item-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LegendItem, LegendSelection } from '@/types/legend';

interface Props {
  items: LegendItem[];
  selection: LegendSelection;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'itemClick', id: string, isModified: boolean): void;
  (e: 'itemHover', id: string): void;
  (e: 'itemLeave', id: string): void;
}>();

const hasSelection = computed(() => props.selection !== 'ALL');

const isSelected = (id: string) => {
  if (props.selection === 'ALL') return true;
  return !!props.selection[id];
};

const handleClick = (event: MouseEvent, id: string) => {
  const isModified = event.metaKey || event.ctrlKey || event.shiftKey;
  emit('itemClick', id, isModified);
};
</script>

<style scoped lang="less">
.compact-legend {
  padding: 8px;

  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background-color: @background-light;
      border: 1px solid @border-color;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: @primary-color;
        background-color: fade(@primary-color, 10%);
      }

      &.is-selected {
        border-color: @primary-color;
        background-color: fade(@primary-color, 15%);
        font-weight: 500;
      }

      &.is-dimmed {
        opacity: 0.4;
      }

      .item-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .item-label {
        font-size: 12px;
        white-space: nowrap;
      }
    }
  }
}
</style>
```

## 📚 参考 Perses 的关键代码

### Tooltip 实现参考
- `perses/ui/components/src/TimeSeriesTooltip/TimeChartTooltip.tsx`
- `perses/ui/components/src/TimeSeriesTooltip/utils.ts`
- `perses/ui/components/src/TimeSeriesTooltip/nearby-series.ts`

### Legend 实现参考
- `perses/ui/components/src/Legend/Legend.tsx`
- `perses/ui/components/src/Legend/CompactLegend.tsx`
- `perses/ui/components/src/Legend/ListLegend.tsx`
- `perses/ui/components/src/Legend/TableLegend.tsx`

## 🎨 关键特性

### Tooltip
1. **智能定位** - 确保不超出屏幕
2. **固定功能** - 点击图表固定/取消固定
3. **附近系列查找** - 自动找到鼠标附近的数据点
4. **深色主题** - 半透明深色背景

### Legend
1. **多种模式** - compact（tag）、list、table
2. **选中交互** - 点击选中，Ctrl+点击多选
3. **Hover 高亮** - 鼠标悬停高亮对应系列
4. **虚拟化** - 大量系列时性能优化

## 🚀 下一步行动

1. 创建 `ChartTooltip.vue` 组件
2. 创建 `CompactLegend.vue` 组件
3. 在 `TimeSeriesChart.vue` 中集成
4. 测试所有功能
5. 优化性能和用户体验

## 📝 注意事项

- 所有文本使用中文
- 遵循 Ant Design 设计规范
- 使用 LESS 变量统一样式
- 确保响应式和性能
- 添加适当的过渡动画

