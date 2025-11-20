<template>
  <div class="time-series-chart-container">
    <div ref="chartRef" class="time-series-chart"></div>

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
  import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { EChartsType } from 'echarts/core';
  import type { Panel, QueryResult, LegendItem } from '@/types';
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
  const chartInstance = ref<any | EChartsType | null>(null);
  const tooltipRef = ref();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  // Legend 选中管理
  const { selectedItems: legendSelection, toggleSeries, isSeriesSelected } = useSeriesSelection();

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

  // 时间序列数据
  const timeSeriesData = computed(() => {
    return props.queryResults.flatMap((result) => result.data);
  });

  // Legend 项目
  const legendItems = computed((): LegendItem[] => {
    const items: LegendItem[] = [];
    const colors = props.panel.options.chart?.colors || [];
    let colorIndex = 0;

    props.queryResults.forEach((result) => {
      result.data.forEach((timeSeries, index) => {
        const label = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || `Series ${index + 1}`;

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

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
    position: (props.panel.options.legend?.position || 'bottom') as 'bottom' | 'right',
    size: 'medium' as const,
  }));

  const initChart = () => {
    if (!chartRef.value) return;

    // 只在有数据时才初始化图表
    if (!props.queryResults || props.queryResults.length === 0 || props.queryResults.every((r) => !r.data || r.data.length === 0)) {
      console.log('Waiting for data before initializing chart');
      return;
    }

    chartInstance.value = echarts.init(chartRef.value) as unknown as EChartsType;

    // 绑定事件到 ZRender 层，以支持 Tooltip
    const zr = chartInstance.value.getZr();

    zr.on('mousemove', (params: any) => {
      if (tooltipRef.value) {
        tooltipRef.value.handleExternalMouseMove(params.event, params.offsetX, params.offsetY);
      }
    });

    zr.on('mouseout', () => {
      if (tooltipRef.value) {
        tooltipRef.value.handleExternalMouseLeave();
      }
    });

    zr.on('click', (params: any) => {
      if (tooltipRef.value) {
        tooltipRef.value.handleExternalClick(params.event, params.offsetX, params.offsetY);
      }
    });

    updateChart();
  };

  const updateChart = () => {
    // 如果图表还没初始化且有数据了，先初始化
    if (!chartInstance.value && chartRef.value) {
      initChart();
      if (!chartInstance.value) return;
    }

    const option = getChartOption();

    console.log('option', option);

    chartInstance.value.setOption(option, true);
  };

  const getChartOption = (): EChartsOption => {
    const { queryResults } = props;
    const { options } = props.panel;

    console.log('queryResults', queryResults);

    // 检查是否有有效数据
    if (!queryResults || queryResults.length === 0 || queryResults.every((r) => !r.data || r.data.length === 0)) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: '#999',
            fontSize: 14,
          },
        },
      };
    }

    // 准备系列数据
    const series: any[] = [];
    const colors = options.chart?.colors || [];
    let colorIndex = 0;

    const specificOptions = options.specific as any;

    queryResults.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries) => {
        if (!timeSeries || !timeSeries.values || timeSeries.values.length === 0) return;

        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        const seriesId = `series-${colorIndex}`;

        // 检查该系列是否被选中
        const isVisible = isSeriesSelected(seriesId);

        const data = timeSeries.values.map(([timestamp, value]) => [timestamp, value]);

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        series.push({
          id: seriesId,
          name: legend,
          type: specificOptions?.mode === 'bar' ? 'bar' : 'line',
          data,
          smooth: options.chart?.smooth ?? true, // 平滑曲线
          showSymbol: options.chart?.showSymbol ?? false, // 显示数据点
          // 区域的填充样式
          areaStyle:
            specificOptions?.mode === 'area'
              ? {
                  opacity: (specificOptions?.fillOpacity ?? 0.3) * (isVisible ? 1 : 0.15),
                }
              : undefined,
          stack: specificOptions?.stackMode !== 'none' ? 'total' : undefined, // 堆叠模式
          // 控制可见性
          silent: !isVisible,
          // 线条样式
          lineStyle: {
            width: options.chart?.line?.width ?? 2,
            type: options.chart?.line?.type ?? 'solid',
            color: color,
            opacity: isVisible ? 1 : 0.15,
          },
          // 数据点样式
          itemStyle: {
            color: color,
            opacity: isVisible ? 1 : 0.15,
          },
        });

        colorIndex++;
      });
    });

    // 如果没有系列数据，返回空配置
    if (series.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: '#999',
            fontSize: 14,
          },
        },
      };
    }

    return {
      // 启用 ECharts 原生 tooltip，用于坐标转换
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'cross', // 轴线类型
          label: {
            show: false,
          },
          lineStyle: {
            color: '#000',
            width: 1,
          },
        },
        // 不显示内容，由自定义 tooltip 处理
        formatter: () => '',
        position: () => [-10000, -10000], // 移到屏幕外
      },
      // 禁用 ECharts 原生 legend，使用自定义
      legend: {
        show: false,
      },
      grid: {
        left: 10,
        right: 10,
        bottom: 0,
        top: 0,
        containLabel: false,
      },
      xAxis: {
        type: 'time',
        show: options.axis?.xAxis?.show ?? true,
        name: options.axis?.xAxis?.name,
        alignTicks: true,
        splitLine: {
          show: true, // 分割线
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        show: options.axis?.yAxis?.show ?? true,
        name: options.axis?.yAxis?.name,
        min: options.axis?.yAxis?.min,
        max: options.axis?.yAxis?.max,
        splitLine: {
          show: true,
        },
        axisLabel: {
          formatter: (value: number) => formatValue(value, options.format || {}),
        },
        axisPointer: {
          type: 'line', // 轴线类型
          label: {
            show: false,
          },
          lineStyle: {
            color: '#000',
            width: 1,
          },
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

  watch(
    () => props.queryResults,
    (newResults) => {
      nextTick(() => {
        // 如果之前没有数据现在有数据了，需要初始化图表
        if (!chartInstance.value && newResults && newResults.length > 0) {
          setTimeout(() => {
            initChart();
          }, 1000);
        } else {
          updateChart();
        }
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
