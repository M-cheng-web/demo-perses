<template>
  <div class="bar-chart-container">
    <div ref="chartRef" class="bar-chart"></div>

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
  import Legend from '@/components/ChartLegend/Legend.vue';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const chartInstance = ref<EChartsType | null>(null);

  // Legend 选中管理
  const { selectedItems: legendSelection, toggleSeries, isSeriesSelected } = useSeriesSelection();

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

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
      console.log('Waiting for data before initializing bar chart');
      return;
    }

    chartInstance.value = echarts.init(chartRef.value) as unknown as EChartsType;
    updateChart();
  };

  const updateChart = () => {
    // 如果图表还没初始化且有数据了，先初始化
    if (!chartInstance.value && chartRef.value) {
      if (props.queryResults && props.queryResults.length > 0 && !props.queryResults.every((r) => !r.data || r.data.length === 0)) {
        chartInstance.value = echarts.init(chartRef.value) as unknown as EChartsType;
      } else {
        return; // 没有数据，不初始化
      }
    }

    if (!chartInstance.value) return;

    const option = getChartOption();
    chartInstance.value.setOption(option, true);
  };

  const getChartOption = (): EChartsOption => {
    const { queryResults } = props;
    const { options } = props.panel;

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
    const isHorizontal = specificOptions?.orientation === 'horizontal';

    // 收集所有时间点作为类目
    const categories = new Set<number>();
    queryResults.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries) => {
        if (!timeSeries || !timeSeries.values) return;

        timeSeries.values.forEach(([timestamp]) => {
          categories.add(timestamp);
        });
      });
    });

    const sortedCategories = Array.from(categories).sort((a, b) => a - b);

    // 将时间戳转换为日期字符串
    const categoryLabels = sortedCategories.map((ts) => {
      const date = new Date(ts);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    // 如果没有数据，返回空配置
    if (sortedCategories.length === 0) {
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

    queryResults.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries) => {
        if (!timeSeries || !timeSeries.values || timeSeries.values.length === 0) return;

        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        const seriesId = `series-${colorIndex}`;

        // 检查该系列是否被选中
        const isVisible = isSeriesSelected(seriesId);

        // 为每个时间点创建数据
        const dataMap = new Map(timeSeries.values.map(([timestamp, value]) => [timestamp, value]));
        const data = sortedCategories.map((ts) => dataMap.get(ts) ?? 0);

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        series.push({
          id: seriesId,
          name: legend,
          type: 'bar',
          data,
          barWidth: specificOptions?.barWidth || 'auto',
          stack: specificOptions?.barMode === 'stack' ? 'total' : undefined,
          // 控制可见性
          itemStyle: {
            color: color,
            opacity: isVisible ? 1 : 0.15,
          },
          emphasis: {
            focus: 'series',
          },
        });

        colorIndex++;
      });
    });

    const axisLabel = {
      formatter: (value: number) => formatValue(value, options.format || {}),
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          let result = `<div style="font-weight: bold;">${params[0].axisValueLabel}</div>`;
          params.forEach((param: any) => {
            result += `<div>${param.marker} ${param.seriesName}: ${formatValue(param.value, options.format || {})}</div>`;
          });
          return result;
        },
      },
      legend: {
        show: false,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: legendOptions.value.show && legendOptions.value.position === 'bottom' ? '15%' : '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: isHorizontal
        ? {
            type: 'value',
            show: options.axis?.xAxis?.show ?? true,
            name: options.axis?.xAxis?.name,
            axisLabel,
          }
        : {
            type: 'category',
            data: categoryLabels,
            show: options.axis?.xAxis?.show ?? true,
            name: options.axis?.xAxis?.name,
          },
      yAxis: isHorizontal
        ? {
            type: 'category',
            data: categoryLabels,
            show: options.axis?.yAxis?.show ?? true,
            name: options.axis?.yAxis?.name,
          }
        : {
            type: 'value',
            show: options.axis?.yAxis?.show ?? true,
            name: options.axis?.yAxis?.name,
            min: options.axis?.yAxis?.min,
            max: options.axis?.yAxis?.max,
            axisLabel,
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

    chartInstance.value.dispatchAction({
      type: 'highlight',
      seriesId: id,
    });
  };

  const handleLegendLeave = (id: string) => {
    if (!chartInstance.value) return;

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
          initChart();
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
  .bar-chart-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .bar-chart {
    flex: 1;
    width: 100%;
    min-height: 200px;
  }
</style>
