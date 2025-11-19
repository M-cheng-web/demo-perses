<template>
  <Teleport to="body">
    <div v-if="isVisible" ref="tooltipRef" class="chart-tooltip" :class="{ 'is-pinned': isPinned }" :style="tooltipStyle">
      <!-- Tooltip 头部 -->
      <div class="tooltip-header">
        <span class="tooltip-time">{{ formattedTime }}</span>
        <div class="tooltip-actions">
          <a-button v-if="isPinned" type="text" size="small" class="unpin-btn" @click="handleUnpin">
            <PushpinFilled />
          </a-button>
          <span v-else class="tooltip-hint">点击图表固定</span>
          <a-button v-if="totalSeries > visibleSeriesCount && !showAllSeries" type="text" size="small" @click="showAllSeries = true">
            显示全部 ({{ totalSeries }})
          </a-button>
        </div>
      </div>

      <!-- Tooltip 内容 -->
      <div class="tooltip-content">
        <div v-for="series in displayedSeries" :key="series.id" class="tooltip-series-item">
          <span class="series-color" :style="{ backgroundColor: series.color }"></span>
          <span class="series-label" :title="series.label">{{ series.label }}</span>
          <span class="series-value">{{ series.formattedValue }}</span>
        </div>
        <div v-if="displayedSeries.length === 0" class="tooltip-empty"> 暂无数据 </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { storeToRefs } from 'pinia';
  import { PushpinFilled } from '@ant-design/icons-vue';
  import type { ECharts } from 'echarts';
  import { formatValue, formatTime } from '@/utils';
  import type { TimeSeriesData } from '@/types';
  import { useTooltipStore } from '@/stores';

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
  }

  const props = withDefaults(defineProps<Props>(), {
    enablePinning: true,
    maxVisibleSeries: 10,
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
      nearbySeries.value = [];
      return;
    }

    try {
      // 检查 ECharts 实例是否已被销毁
      if (props.chartInstance.isDisposed()) {
        nearbySeries.value = [];
        return;
      }

      // 检查 option 是否已设置（确保坐标系统已初始化）
      const option = props.chartInstance.getOption();
      if (!option || !option.series || (option.series as any[]).length === 0) {
        nearbySeries.value = [];
        return;
      }

      const pointInPixel = [mousePos.value.x, mousePos.value.y];
      const pointInGrid = props.chartInstance.convertFromPixel({ seriesIndex: 0 }, pointInPixel);

      if (!pointInGrid || !Array.isArray(pointInGrid)) {
        nearbySeries.value = [];
        return;
      }

      const [xValue] = pointInGrid;
      if (xValue === undefined || typeof xValue !== 'number') {
        nearbySeries.value = [];
        return;
      }
      currentTime.value = xValue;

      const series: NearbySeriesItem[] = [];
      const seriesOptions = option.series as any[];

      props.data.forEach((timeSeries, index) => {
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
          const seriesOption = seriesOptions?.[index];
          const color = seriesOption?.lineStyle?.color || seriesOption?.itemStyle?.color || '#5470c6';

          const label = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || `Series ${index + 1}`;

          series.push({
            id: `series-${index}`,
            label,
            color,
            value: closestPoint[1],
            formattedValue: formatValue(closestPoint[1], props.formatOptions || {}),
            timestamp: closestPoint[0],
          });
        }
      });

      nearbySeries.value = series;
    } catch (error) {
      console.error('Error finding nearby series:', error);
      nearbySeries.value = [];
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // 检查是否在当前图表容器内
    if (props.chartContainerRef && target.tagName === 'CANVAS') {
      const canvas = target;
      const container = props.chartContainerRef;

      // 检查 canvas 是否是当前容器的子元素
      if (container.contains(canvas)) {
        isMouseOverChart.value = true;

        // 如果当前图表被固定，不更新位置和数据
        if (isPinned.value) {
          return;
        }

        // 更新鼠标位置和数据
        mousePos.value = {
          x: event.clientX,
          y: event.clientY,
          pageX: event.pageX,
          pageY: event.pageY,
        };

        findNearbySeries();
      } else {
        // Canvas 不属于当前容器，清除状态
        isMouseOverChart.value = false;
        // 如果当前图表没有被固定，清除数据
        if (!isPinned.value) {
          nearbySeries.value = [];
        }
      }
    } else {
      // 如果不在 canvas 上，清除状态
      isMouseOverChart.value = false;
      // 如果当前图表没有被固定，清除数据
      if (!isPinned.value) {
        nearbySeries.value = [];
      }
    }
  };

  const handleScroll = () => {
    // 滚动时取消固定
    if (isPinned.value) {
      handleUnpin();
    }
  };

  const handleChartClick = (event: MouseEvent) => {
    if (!props.enablePinning) return;

    const target = event.target as HTMLElement;

    // 检查是否在当前图表的 canvas 上
    if (props.chartContainerRef && target.tagName === 'CANVAS') {
      const canvas = target;
      const container = props.chartContainerRef;

      if (!container.contains(canvas)) {
        return; // 不是当前图表的 canvas，忽略点击
      }
    } else if (target.tagName !== 'CANVAS') {
      return;
    }

    // 如果当前图表已经固定，忽略点击（不更新位置和内容）
    if (isPinned.value) {
      return;
    }

    // 固定当前图表的 tooltip，取消其他图表的固定
    tooltipStore.pinTooltip(props.chartId);

    // 保存固定位置
    pinnedPos.value = {
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    };

    // 更新鼠标位置（用于 tooltip 定位）
    mousePos.value = {
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    };

    // 保存固定时的数据（防止后续鼠标移动改变内容）
    findNearbySeries();

    emit('pin', { x: event.pageX, y: event.pageY });
  };

  const handleUnpin = () => {
    tooltipStore.unpinTooltip();
    pinnedPos.value = null;
    showAllSeries.value = false;
    emit('unpin');
  };

  // Lifecycle
  onMounted(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, true); // 使用捕获阶段监听所有滚动
  });

  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('scroll', handleScroll, true);
  });

  // 暴露方法供父组件使用
  defineExpose({
    handleChartClick,
    unpin: handleUnpin,
  });
</script>

<style scoped lang="less">
  .chart-tooltip {
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

    &.is-pinned {
      pointer-events: auto;
      background-color: rgba(40, 40, 40, 0.98);
    }

    .tooltip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      gap: 8px;

      .tooltip-time {
        font-weight: 500;
        font-size: 13px;
        flex-shrink: 0;
      }

      .tooltip-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;

        .tooltip-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          white-space: nowrap;
        }

        :deep(.ant-btn) {
          color: #fff;
          padding: 0 4px;
          height: 20px;
          font-size: 11px;

          &:hover {
            color: @primary-color;
            background-color: rgba(255, 255, 255, 0.1);
          }

          &.unpin-btn {
            padding: 0;
            width: 20px;
          }
        }
      }
    }

    .tooltip-content {
      padding: 8px 12px;
      max-height: 400px;
      overflow-y: auto;

      /* 自定义滚动条 */
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

      .tooltip-series-item {
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
          font-size: 12px;
          min-width: 0;
        }

        .series-value {
          font-weight: 600;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          color: #fff;
          flex-shrink: 0;
        }
      }

      .tooltip-empty {
        padding: 20px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }
    }
  }
</style>
