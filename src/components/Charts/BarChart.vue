<!-- 柱状图 -->
<template>
  <div class="bar-chart-container">
    <a-spin :spinning="isLoading">
      <div ref="chartRef" class="bar-chart"></div>

      <!-- 自定义 Legend -->
      <Legend
        v-if="legendItems.length > 0"
        :items="legendItems"
        :selection="selectedItems"
        :options="legendOptions"
        :global-selection-state="globalSelectionState"
        @item-click="handleLegendClick"
        @item-hover="handleLegendHover"
        @item-leave="handleLegendLeave"
        @toggle-global-selection="toggleGlobalSelection"
      />
    </a-spin>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick } from 'vue';
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult } from '@/types';
  import { formatValue } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';
  import { useLegend } from '@/composables/useLegend';
  import { useChartInit } from '@/composables/useChartInit';
  import Legend from '@/components/ChartLegend/Legend.vue';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  /**
   * 使用图表初始化 Hook
   * 等待 queryResults 和 panel.options 都有效后才初始化一次
   */
  const { chartInstance, isLoading } = useChartInit<ECharts>({
    chartRef,
    dependencies: [
      {
        value: computed(() => props.queryResults),
        isValid: (results: QueryResult[]) => results && results.length > 0 && results.some((r) => r.data && r.data.length > 0),
      },
      {
        value: computed(() => props.panel.options),
        isValid: (options: any) => options && Object.keys(options).length > 0,
      },
    ],
    onUpdate: (instance) => {
      console.log('[BarChart] Updating chart...');
      nextTick(() => {
        updateChart(instance);
      });
    },
  });

  /**
   * 更新图表配置和数据
   */
  const updateChart = (instance?: ECharts) => {
    const chartInst = instance || chartInstance.value;
    if (!chartInst) {
      console.warn('Bar chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update bar chart:', error);
    }
  };

  // 使用 Legend Hook（在 chartInstance 初始化后）
  const {
    selectedItems,
    legendItems,
    legendOptions,
    globalSelectionState,
    getSeriesVisibility,
    handleLegendClick,
    handleLegendHover,
    handleLegendLeave,
    toggleGlobalSelection,
  } = useLegend({
    panel: computed(() => props.panel),
    queryResults: computed(() => props.queryResults),
    chartInstance,
    updateChart: () => updateChart(),
  });

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

        // 获取该系列的显示状态
        const visibility = getSeriesVisibility(seriesId);

        // 如果是隐藏状态，直接跳过，不添加到 series 中
        if (visibility === 'hidden') {
          colorIndex++;
          return;
        }

        // 为每个时间点创建数据
        const dataMap = new Map(timeSeries.values.map(([timestamp, value]) => [timestamp, value]));
        const data = sortedCategories.map((ts) => dataMap.get(ts) ?? 0);

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        // 根据可见性状态设置透明度
        const opacity = visibility === 'visible' ? 1 : 0.08;

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
            opacity: opacity,
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

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);
</script>

<style scoped lang="less">
  .bar-chart-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;

    :deep(.ant-spin-container) {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }

  .bar-chart {
    flex: 1;
    width: 100%;
    min-height: 200px;
  }
</style>
