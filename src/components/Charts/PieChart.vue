<template>
  <div ref="chartRef" class="pie-chart"></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { Panel, QueryResult } from '@/types';
  import { formatValue } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const chartInstance = ref<echarts.ECharts | null>(null);

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

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
    const specificOptions = options.specific as any;

    // 准备饼图数据
    const data: any[] = [];

    queryResults.forEach((result) => {
      result.data.forEach((timeSeries) => {
        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        // 取最后一个值
        const lastValue = timeSeries.values[timeSeries.values.length - 1];
        if (lastValue) {
          data.push({
            name: legend,
            value: lastValue[1],
          });
        }
      });
    });

    const isPie = specificOptions?.pieType !== 'doughnut';

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const value = formatValue(params.value, options.format || {});
          return `${params.marker} ${params.name}: ${value} (${params.percent}%)`;
        },
      },
      legend: {
        show: options.legend?.show ?? true,
        type: 'scroll',
        orient: options.legend?.orient ?? 'vertical',
        left: options.legend?.position === 'left' ? 'left' : undefined,
        right: options.legend?.position === 'right' ? 'right' : undefined,
        top: options.legend?.position === 'top' ? 'top' : 'center',
        bottom: options.legend?.position === 'bottom' ? 'bottom' : undefined,
      },
      series: [
        {
          type: 'pie',
          radius: isPie ? '60%' : [`${specificOptions?.innerRadius || 40}%`, '70%'],
          center: ['50%', '50%'],
          data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: {
            show: specificOptions?.showPercentage ?? true,
            formatter: '{b}: {d}%',
          },
        },
      ],
      color: options.chart?.colors || undefined,
    };
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
  .pie-chart {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }
</style>
