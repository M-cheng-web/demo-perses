<template>
  <div class="time-series-chart-container">
    <div 
      ref="chartRef" 
      class="time-series-chart" 
      @click="handleChartClick"
    ></div>

    <!-- 自定义 Tooltip -->
    <ChartTooltip
      ref="tooltipRef"
      :chart-id="chartId"
      :chart-instance="chartInstance"
      :chart-container-ref="chartRef"
      :data="timeSeriesData"
      :format-options="panel.options.format"
      :enable-pinning="true"
    />

    <!-- 自定义 Legend -->
    <Legend
      v-if="legendItems.length > 0"
      :items="legendItems"
      :selection="legendSelection"
      :options="legendOptions"
      @item-click="handleLegendClick"
      @item-hover="handleLegendHover"
      @item-leave="handleLegendLeave"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { Panel, QueryResult, LegendItem, LegendSelection } from '@/types';
  import { formatValue } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';
  import { useSeriesSelection } from '@/composables/useSeriesSelection';
  import ChartTooltip from '@/components/ChartTooltip/ChartTooltip.vue';
  import Legend from '@/components/ChartLegend/Legend.vue';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const chartInstance = ref<echarts.ECharts | null>(null);
  const tooltipRef = ref();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  // Legend 选中管理
  const { selectedItems: legendSelection, toggleSeries, isSeriesSelected } = useSeriesSelection();

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

  // 时间序列数据
  const timeSeriesData = computed(() => {
    return props.queryResults.flatMap(result => result.data);
  });

  // Legend 项目
  const legendItems = computed((): LegendItem[] => {
    const items: LegendItem[] = [];
    const colors = props.panel.options.chart?.colors || [];
    let colorIndex = 0;

    props.queryResults.forEach((result) => {
      result.data.forEach((timeSeries, index) => {
        const label = timeSeries.metric.__legend__ || 
                     timeSeries.metric.__name__ || 
                     `Series ${index + 1}`;
        
        const color = colors[colorIndex % colors.length] || 
                     `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;
        
        items.push({
          id: `series-${colorIndex}`,
          label,
          color,
        });

        colorIndex++;
      });
    });

    return items;
  });

  // Legend 配置
  const legendOptions = computed(() => ({
    show: props.panel.options.legend?.show !== false,
    mode: (props.panel.options.legend as any)?.mode || 'compact',
    position: props.panel.options.legend?.position || 'bottom',
    size: 'medium' as const,
  }));

  const initChart = () => {
    if (!chartRef.value) return;

    chartInstance.value = echarts.init(chartRef.value);
    updateChart();
  };

  const updateChart = () => {
    if (!chartInstance.value) return;

    const option = getChartOption();
    chartInstance.value.setOption(option, true);
  };

  const getChartOption = (): EChartsOption => {
    const { queryResults } = props;
    const { options } = props.panel;

    // 准备系列数据
    const series: any[] = [];
    const colors = options.chart?.colors || [];
    let colorIndex = 0;

    const specificOptions = options.specific as any;

    queryResults.forEach((result) => {
      result.data.forEach((timeSeries, index) => {
        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        const seriesId = `series-${colorIndex}`;
        
        // 检查该系列是否被选中
        const isVisible = isSeriesSelected(seriesId);

        const data = timeSeries.values.map(([timestamp, value]) => [timestamp, value]);

        const color = colors[colorIndex % colors.length] || 
                     `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        series.push({
          id: seriesId,
          name: legend,
          type: specificOptions?.mode === 'bar' ? 'bar' : 'line',
          data,
          smooth: options.chart?.smooth ?? true,
          showSymbol: options.chart?.showSymbol ?? false,
          areaStyle: specificOptions?.mode === 'area' ? { 
            opacity: (specificOptions?.fillOpacity ?? 0.3) * (isVisible ? 1 : 0.15)
          } : undefined,
          stack: specificOptions?.stackMode !== 'none' ? 'total' : undefined,
          // 控制可见性
          silent: !isVisible,
          lineStyle: {
            width: options.chart?.line?.width ?? 2,
            type: options.chart?.line?.type ?? 'solid',
            color: color,
            opacity: isVisible ? 1 : 0.15,
          },
          itemStyle: {
            color: color,
            opacity: isVisible ? 1 : 0.15,
          },
        });

        colorIndex++;
      });
    });

    return {
      // 禁用 ECharts 原生 tooltip，使用自定义
      tooltip: {
        show: false,
      },
      // 禁用 ECharts 原生 legend，使用自定义
      legend: {
        show: false,
      },
      // 添加 axisPointer - Y轴竖线跟随鼠标
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: {
          backgroundColor: '#777',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: legendOptions.value.show && legendOptions.value.position === 'bottom' ? '15%' : '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        show: options.axis?.xAxis?.show ?? true,
        name: options.axis?.xAxis?.name,
        splitLine: {
          show: options.axis?.xAxis?.splitLine?.show ?? false,
        },
        axisPointer: {
          show: true,
          type: 'line',
          lineStyle: {
            type: 'solid',
            color: '#aaa',
            width: 1,
          },
          label: {
            show: false,
          },
        },
      },
      yAxis: {
        type: 'value',
        show: options.axis?.yAxis?.show ?? true,
        name: options.axis?.yAxis?.name,
        min: options.axis?.yAxis?.min,
        max: options.axis?.yAxis?.max,
        splitLine: {
          show: options.axis?.yAxis?.splitLine?.show ?? true,
        },
        axisLabel: {
          formatter: (value: number) => formatValue(value, options.format || {}),
        },
      },
      series,
    };
  };

  // Legend 交互处理
  const handleLegendClick = (id: string, isModified: boolean) => {
    toggleSeries(id, isModified);
    nextTick(() => {
      updateChart();
    });
  };

  const handleLegendHover = (id: string) => {
    if (!chartInstance.value) return;
    
    // 高亮对应系列
    chartInstance.value.dispatchAction({
      type: 'highlight',
      seriesId: id,
    });
  };

  const handleLegendLeave = (id: string) => {
    if (!chartInstance.value) return;
    
    // 取消高亮
    chartInstance.value.dispatchAction({
      type: 'downplay',
      seriesId: id,
    });
  };

  // Tooltip 交互处理
  const handleChartClick = (event: MouseEvent) => {
    tooltipRef.value?.handleChartClick(event);
  };

  watch(
    () => props.queryResults,
    () => {
      nextTick(() => {
        updateChart();
      });
    },
    { deep: true }
  );

  watch(
    () => props.panel.options,
    () => {
      nextTick(() => {
        updateChart();
      });
    },
    { deep: true }
  );

  onMounted(() => {
    initChart();
  });

  onUnmounted(() => {
    chartInstance.value?.dispose();
    chartInstance.value = null;
  });
</script>

<style scoped lang="less">
  .time-series-chart-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .time-series-chart {
    flex: 1;
    width: 100%;
    min-height: 200px;
  }
</style>
