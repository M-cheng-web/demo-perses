<template>
  <div ref="chartRef" class="heatmap-chart"></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { Panel, QueryResult, HeatmapOptions } from '@/types';
  import { formatValue, formatTime } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const chartInstance = ref<echarts.ECharts | null>(null);

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

  const heatmapOptions = computed(() => (props.panel.options.specific as HeatmapOptions) || {});

  // 颜色方案映射
  const colorSchemes: Record<string, [string, string]> = {
    blue: ['#e3f2fd', '#1565c0'],
    green: ['#e8f5e9', '#2e7d32'],
    red: ['#ffebee', '#c62828'],
    yellow: ['#fffde7', '#f57f17'],
    purple: ['#f3e5f5', '#6a1b9a'],
  };

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
    if (!props.queryResults.length) {
      return {};
    }

    // 准备数据
    const seriesNames: string[] = [];
    const timePoints: number[] = [];
    const dataMap = new Map<string, Map<number, number>>();

    // 收集所有时间序列
    props.queryResults.forEach((result) => {
      result.data.forEach((timeSeries) => {
        const seriesName = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        if (!seriesNames.includes(seriesName)) {
          seriesNames.push(seriesName);
          dataMap.set(seriesName, new Map());
        }

        timeSeries.values.forEach(([timestamp, value]) => {
          if (!timePoints.includes(timestamp)) {
            timePoints.push(timestamp);
          }
          dataMap.get(seriesName)!.set(timestamp, value);
        });
      });
    });

    // 排序时间点
    timePoints.sort((a, b) => a - b);

    // 构建热力图数据 [x, y, value]
    const heatmapData: [number, number, number][] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;

    seriesNames.forEach((seriesName, yIndex) => {
      const seriesData = dataMap.get(seriesName)!;
      timePoints.forEach((time, xIndex) => {
        const value = seriesData.get(time) || 0;
        heatmapData.push([xIndex, yIndex, value]);
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      });
    });

    // 获取颜色配置
    const colorScheme = heatmapOptions.value.colorScheme || 'blue';
    const colorRange = colorSchemes[colorScheme] || colorSchemes.blue;
    const minColor = colorRange?.[0] || '#e3f2fd';
    const maxColor = colorRange?.[1] || '#1565c0';

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const { data } = params;
          const [xIndex, yIndex, value] = data;
          const timestamp = timePoints[xIndex];
          if (timestamp === undefined) return '';
          const time = formatTime(timestamp, 'YYYY-MM-DD HH:mm:ss');
          const series = seriesNames[yIndex] || 'unknown';
          const formattedValue = formatValue(value, props.panel.options.format || {});
          return `${time}<br/>${series}: ${formattedValue}`;
        },
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '10%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: timePoints.map((t) => formatTime(t, 'HH:mm:ss')),
        splitArea: {
          show: true,
        },
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'category',
        data: seriesNames,
        splitArea: {
          show: true,
        },
        axisLabel: {
          fontSize: 11,
        },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: [heatmapOptions.value.minColor || minColor, heatmapOptions.value.maxColor || maxColor],
        },
        text: ['高', '低'],
        textStyle: {
          fontSize: 11,
        },
      },
      series: [
        {
          name: '热力图',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: heatmapOptions.value.showValue ?? false,
            fontSize: 10,
            formatter: (params: any) => {
              return formatValue(params.data[2], props.panel.options.format || {});
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
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
  .heatmap-chart {
    width: 100%;
    height: 100%;
    min-height: 300px;
  }
</style>
