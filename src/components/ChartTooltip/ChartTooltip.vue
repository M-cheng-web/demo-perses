<template>
  <Teleport to="body">
    <div v-if="isVisible" ref="tooltipRef" :class="[bem(), bem({ pinned: isPinned })]" :style="tooltipStyle">
      <!-- Tooltip 头部 -->
      <div :class="bem('header')">
        <span :class="bem('time')">{{ formattedTime }}</span>
        <div :class="bem('actions')">
          <Button v-if="isPinned" type="text" size="small" :class="bem('unpin-btn')" @click="handleUnpin">
            <PushpinFilled />
          </Button>
          <span v-else :class="bem('hint')">点击图表固定</span>
          <Button v-if="totalSeries > visibleSeriesCount && !showAllSeries" type="text" size="small" @click="showAllSeries = true">
            显示全部 ({{ totalSeries }})
          </Button>
        </div>
      </div>

      <!-- Tooltip 内容 -->
      <div :class="bem('content')">
        <div v-for="series in displayedSeries" :key="series.id" :class="bem('series-item')">
          <span :class="bem('series-color')" :style="{ backgroundColor: series.color }"></span>
          <span :class="bem('series-label')" :title="series.label">{{ series.label }}</span>
          <span :class="bem('series-value')">{{ series.formattedValue }}</span>
        </div>
        <div v-if="displayedSeries.length === 0" :class="bem('empty')"> 暂无数据 </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { Button } from 'ant-design-vue';
  import { storeToRefs } from 'pinia';
  import { PushpinFilled } from '@ant-design/icons-vue';
  import type { ECharts } from 'echarts';
  import { formatValue, formatTime, createNamespace } from '@/utils';
  import type { TimeSeriesData } from '@/types';
  import { useTooltipStore } from '@/stores';

  const [_, bem] = createNamespace('chart-tooltip');

  interface NearbySeriesItem {
    id: string;
    label: string;
    color: string;
    value: number;
    formattedValue: string;
    timestamp: number;
  }

  interface Props {
    chartId: string;
    chartInstance: ECharts | null;
    chartContainerRef: HTMLElement | undefined;
    data: TimeSeriesData[];
    formatOptions?: any;
    enablePinning?: boolean;
    maxVisibleSeries?: number;
    /** 用于判断系列是否被选中显示的函数 */
    isSeriesVisible?: (seriesId: string) => boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    enablePinning: true,
    maxVisibleSeries: 10,
    isSeriesVisible: () => true, // 默认所有系列都可见
  });

  const emit = defineEmits<{
    (e: 'pin', position: { x: number; y: number }): void;
    (e: 'unpin'): void;
  }>();

  // Tooltip Store
  const tooltipStore = useTooltipStore();
  const { pinnedChartId } = storeToRefs(tooltipStore);

  // State
  const tooltipRef = ref<HTMLElement>();
  const mousePos = ref<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const pinnedPos = ref<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const nearbySeries = ref<NearbySeriesItem[]>([]);
  const currentTime = ref<number>(0);
  const showAllSeries = ref(false);
  const isMouseOverChart = ref(false);
  let updatePending = false; // 防止重复更新
  let rafId: number | null = null; // requestAnimationFrame ID

  // Computed
  const isPinned = computed(() => pinnedChartId.value === props.chartId);

  const totalSeries = computed(() => props.data.length);

  const visibleSeriesCount = computed(() =>
    showAllSeries.value ? nearbySeries.value.length : Math.min(props.maxVisibleSeries, nearbySeries.value.length)
  );

  const displayedSeries = computed(() => {
    const count = visibleSeriesCount.value;
    return nearbySeries.value.slice(0, count);
  });

  const isVisible = computed(() => {
    // 如果当前图表被固定，则始终显示
    if (isPinned.value) {
      return nearbySeries.value.length > 0;
    }

    // 如果鼠标在当前图表上，显示当前图表的 tooltip（即使其他图表有固定的）
    if (isMouseOverChart.value) {
      return nearbySeries.value.length > 0;
    }

    return false;
  });

  const formattedTime = computed(() => {
    if (!currentTime.value) return '';
    return formatTime(currentTime.value, 'YYYY-MM-DD HH:mm:ss');
  });

  const tooltipStyle = computed(() => {
    const pos = isPinned.value && pinnedPos.value ? pinnedPos.value : mousePos.value;
    if (!pos) return { visibility: 'hidden' as const };

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
        y = window.innerHeight - rect.height - padding;
      }
      if (x < padding) {
        x = padding;
      }
      if (y < padding) {
        y = padding;
      }
    }

    return {
      transform: `translate3d(${x}px, ${y}px, 0)`,
      visibility: 'visible' as const,
    };
  });

  // Methods
  const findNearbySeries = () => {
    if (!props.chartInstance || !mousePos.value) {
      return;
    }

    try {
      // 检查 ECharts 实例是否已被销毁
      if (props.chartInstance.isDisposed()) {
        return;
      }

      // 检查 option 是否已设置（确保坐标系统已初始化）
      const option = props.chartInstance.getOption();
      if (!option || !option.series || (option.series as any[]).length === 0) {
        return;
      }

      const pointInPixel = [mousePos.value.x, mousePos.value.y];
      const pointInGrid = props.chartInstance.convertFromPixel({ seriesIndex: 0 }, pointInPixel);

      if (!pointInGrid || !Array.isArray(pointInGrid)) {
        return;
      }

      const [xValue] = pointInGrid;
      if (xValue === undefined || typeof xValue !== 'number') {
        return;
      }
      currentTime.value = xValue;

      const series: NearbySeriesItem[] = [];
      const seriesOptions = option.series as any[];

      // 遍历所有数据，但只显示被选中的系列
      let visibleSeriesIndex = 0;
      props.data.forEach((timeSeries, dataIndex) => {
        const seriesId = `series-${dataIndex}`;

        // 检查该系列是否被选中（如果未选中，跳过）
        if (props.isSeriesVisible && !props.isSeriesVisible(seriesId)) {
          return;
        }

        // 找到最接近的时间点
        let closestPoint: [number, number] | null = null;
        let minDistance = Infinity;

        timeSeries.values.forEach(([timestamp, value]) => {
          const distance = Math.abs(timestamp - xValue);
          if (distance < minDistance && distance < 60000) {
            // 60秒容差
            minDistance = distance;
            closestPoint = [timestamp, value];
          }
        });

        if (closestPoint) {
          // 从 ECharts option 中获取对应的系列配置
          // 注意：由于隐藏的系列不在 option.series 中，需要使用 visibleSeriesIndex
          const seriesOption = seriesOptions?.[visibleSeriesIndex];
          const color = seriesOption?.lineStyle?.color || seriesOption?.itemStyle?.color || '#5470c6';

          const label = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || `Series ${dataIndex + 1}`;

          series.push({
            id: seriesId,
            label,
            color,
            value: closestPoint[1],
            formattedValue: formatValue(closestPoint[1], props.formatOptions || {}),
            timestamp: closestPoint[0],
          });

          visibleSeriesIndex++;
        }
      });

      nearbySeries.value = series;
    } catch (error) {
      console.error('Error finding nearby series:', error);
      // 出错时不清空数据，保持上一次的数据
    }
  };

  // 由父组件调用，处理鼠标移动
  const handleExternalMouseMove = (event: MouseEvent, offsetX: number, offsetY: number) => {
    isMouseOverChart.value = true;

    // 如果当前图表被固定，不更新位置和数据
    if (isPinned.value) {
      return;
    }

    // 更新鼠标位置
    mousePos.value = {
      x: offsetX,
      y: offsetY,
      pageX: event.pageX,
      pageY: event.pageY,
    };

    // 使用 requestAnimationFrame 来批量处理更新，避免频繁渲染导致闪烁
    if (!updatePending) {
      updatePending = true;
      rafId = requestAnimationFrame(() => {
        findNearbySeries();
        updatePending = false;
      });
    }
  };

  // 由父组件调用，处理鼠标移出
  const handleExternalMouseLeave = () => {
    isMouseOverChart.value = false;

    // 取消待处理的更新
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      updatePending = false;
    }

    if (!isPinned.value) {
      nearbySeries.value = [];
    }
  };

  // 由父组件调用，处理点击
  const handleExternalClick = (event: MouseEvent, offsetX: number, offsetY: number) => {
    if (!props.enablePinning) return;

    // 如果当前图表已经固定，忽略点击（不更新位置和内容）
    if (isPinned.value) {
      return;
    }

    // 固定当前图表的 tooltip，取消其他图表的固定
    tooltipStore.pinTooltip(props.chartId);

    // 保存固定位置
    pinnedPos.value = {
      x: offsetX,
      y: offsetY,
      pageX: event.pageX,
      pageY: event.pageY,
    };

    // 更新鼠标位置（用于 tooltip 定位）
    mousePos.value = {
      x: offsetX,
      y: offsetY,
      pageX: event.pageX,
      pageY: event.pageY,
    };

    // 保存固定时的数据（防止后续鼠标移动改变内容）
    findNearbySeries();

    emit('pin', { x: event.pageX, y: event.pageY });
  };

  const handleScroll = () => {
    // 滚动时取消固定
    if (isPinned.value) {
      handleUnpin();
    }
  };

  const handleUnpin = () => {
    tooltipStore.unpinTooltip();
    pinnedPos.value = null;
    showAllSeries.value = false;
    emit('unpin');
  };

  // Lifecycle
  onMounted(() => {
    // 移除全局 mousemove 监听
    window.addEventListener('scroll', handleScroll, true); // 使用捕获阶段监听所有滚动
  });

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll, true);

    // 清理待处理的动画帧
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  // 暴露方法供父组件使用
  defineExpose({
    handleExternalMouseMove,
    handleExternalMouseLeave,
    handleExternalClick,
    unpin: handleUnpin,
  });
</script>

<style scoped lang="less">
  .dp-chart-tooltip {
    position: fixed;
    top: 0;
    left: 0;
    min-width: 220px;
    max-width: 450px;
    background-color: rgba(40, 40, 40, 0.96);
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);

    &.dp-chart-tooltip--pinned {
      pointer-events: auto;
      background-color: rgba(40, 40, 40, 0.98);
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      gap: 8px;
    }

    &__time {
      font-weight: 500;
      font-size: 13px;
      flex-shrink: 0;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      :deep(.ant-btn) {
        color: #fff;
        padding: 0 4px;
        height: 20px;
        font-size: 11px;

        &:hover {
          color: @primary-color;
          background-color: rgba(255, 255, 255, 0.1);
        }
      }
    }

    &__hint {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
    }

    &__unpin-btn {
      :deep(.ant-btn) {
        padding: 0;
        width: 20px;
      }
    }

    &__content {
      padding: 8px 12px;
      max-height: 400px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }

    &__series-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
      transition: background-color 0.2s;

      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
        margin: 0 -4px;
        padding: 5px 4px;
        border-radius: 3px;
      }
    }

    &__series-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    &__series-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      min-width: 0;
    }

    &__series-value {
      font-weight: 600;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      color: #fff;
      flex-shrink: 0;
    }

    &__empty {
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 12px;
    }
  }
</style>
