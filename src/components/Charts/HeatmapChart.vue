<!-- 热力图 -->
<template>
  <div class="heatmap-chart-container">
    <Spin v-if="isLoading" class="loading-spinner" :spinning="true" />

    <div class="chart-wrapper">
      <div ref="chartRef" class="heatmap-chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick } from 'vue';
  import { Spin } from 'ant-design-vue';
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult, HeatmapOptions } from '@/types';
  import { formatValue, formatTime } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';
  import { useChartInit } from '@/composables/useChartInit';
  import { useChartTooltip, type TooltipData } from '@/composables/useChartTooltip';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  const heatmapOptions = computed(() => (props.panel.options.specific as HeatmapOptions) || {});

  // 颜色方案映射
  const colorSchemes: Record<string, [string, string]> = {
    blue: ['#e3f2fd', '#1565c0'],
    green: ['#e8f5e9', '#2e7d32'],
    red: ['#ffebee', '#c62828'],
    yellow: ['#fffde7', '#f57f17'],
    purple: ['#f3e5f5', '#6a1b9a'],
  };

  /**
   * 使用图表初始化 Hook
   * 等待 queryResults 和 panel.options 都有效后才初始化一次
   */
  const { getInstance, isLoading } = useChartInit<ECharts>({
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
    onChartCreated: (instance) => {
      nextTick(() => {
        updateChart(instance);
        registerTooltip();
        initChartResize();
      });
    },
    onUpdate: (instance) => {
      nextTick(() => {
        updateChart(instance);
        updateTooltip();
      });
    },
  });

  /**
   * 使用图表 resize Hook
   */
  const { initChartResize } = useChartResize(
    computed(() => getInstance()),
    chartRef
  );

  /**
   * 使用 Tooltip 注册管理 Hook
   * 自动处理图表的注册、更新和销毁
   */
  const {
    updateTooltipData,
    register: registerTooltip,
    update: updateTooltip,
  } = useChartTooltip({
    chartId,
    chartInstance: computed(() => getInstance()),
    chartContainerRef: chartRef,
    dataProvider: () => null, // 热力图使用自定义数据提供器
  });

  /**
   * 更新图表配置和数据
   */
  function updateChart(instance?: ECharts | null) {
    const chartInst = instance;
    if (!chartInst) {
      console.warn('Heatmap chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update heatmap chart:', error);
    }
  }

  function getChartOption(): EChartsOption {
    if (!props.queryResults.length || props.queryResults.every((r) => !r.data || r.data.length === 0)) {
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
      // 启用 ECharts 原生 tooltip，用于获取准确的数据
      tooltip: {
        position: 'top',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          if (!params || !params.data) {
            updateTooltipData(null);
            return '';
          }

          const { data } = params;
          const [xIndex, yIndex, value] = data;
          const timestamp = timePoints[xIndex];
          if (timestamp === undefined) {
            updateTooltipData(null);
            return '';
          }

          const time = formatTime(timestamp, 'YYYY-MM-DD HH:mm:ss');
          const seriesName = seriesNames[yIndex] || 'unknown';
          const formattedValue = formatValue(value, props.panel.options.format || {});

          const tooltipData: TooltipData = {
            time: time,
            series: [
              {
                id: `series-${yIndex}`,
                label: seriesName,
                color: params.color,
                value: value,
                formattedValue: formattedValue,
              },
            ],
          };

          updateTooltipData(tooltipData);
          return ''; // 返回空字符串，我们使用自定义 Tooltip 展示
        },
      },
      grid: {
        left: 10,
        right: 10,
        bottom: 0,
        top: 0,
        containLabel: false,
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
  }
</script>

<style scoped lang="less">
  .heatmap-chart-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }

  .chart-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .heatmap-chart {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
</style>
