<!-- 热力图 -->
<template>
  <div :class="bem()">
    <div :class="bem('wrapper')">
      <div ref="chartRef" :class="bem('chart')"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult, HeatmapOptions } from '@grafana-fast/types';
  import { formatValue, formatTime, createNamespace } from '/#/utils';
  import { createNoDataOption, hasQuerySeriesData } from '/#/components/Charts/chartOptionHelpers';
  import { getHeatmapTriplet, normalizeNumericValue, toCssColor, toItemTooltipParam } from '/#/components/Charts/tooltipFormatterTypes';
  import { useChartPanelLifecycle } from '/#/composables/useChartPanelLifecycle';
  import { useChartTooltip, type TooltipData } from '/#/composables/useChartTooltip';
  import { getEChartsTheme } from '/#/utils/echartsTheme';

  const [_, bem] = createNamespace('heatmap-chart');

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

  const { getInstance } = useChartPanelLifecycle<ECharts>({
    chartRef,
    queryResults: computed(() => props.queryResults),
    panelOptions: computed(() => props.panel.options),
    onChartCreated: (instance) => {
      updateChart(instance);
      registerTooltip();
    },
    onChartUpdated: (instance) => {
      updateChart(instance);
      updateTooltip();
    },
  });

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
    dataProvider: {
      getData: () => null, // 热力图使用自定义数据提供器
    },
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
    const theme = getEChartsTheme(chartRef.value);
    if (!hasQuerySeriesData(props.queryResults)) {
      return createNoDataOption(theme);
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
    const minColor = colorScheme === 'blue' ? theme.palette[7] || colorRange?.[0] : colorRange?.[0];
    const maxColor = colorScheme === 'blue' ? theme.palette[0] || colorRange?.[1] : colorRange?.[1];

    return {
      ...theme.baseOption,
      // 禁用动画，减少高频刷新时的视觉抖动
      animation: false,
      // 启用 ECharts 原生 tooltip，用于获取准确的数据
      tooltip: {
        ...theme.baseOption.tooltip,
        // showContent: false,
        position: 'top',
        triggerOn: 'mousemove',
        padding: 10,
        // renderMode: 'text',
        formatter: (params) => {
          const itemParam = toItemTooltipParam(params);
          if (!itemParam) {
            updateTooltipData(null);
            return '';
          }

          const triplet = getHeatmapTriplet(itemParam.data);
          if (!triplet) {
            updateTooltipData(null);
            return '';
          }
          const [xIndex, yIndex, value] = triplet;
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
                color: toCssColor(itemParam.color),
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
          color: theme.textSecondary,
        },
        axisLine: {
          lineStyle: {
            color: theme.borderMuted,
          },
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
          color: theme.textSecondary,
        },
        axisLine: {
          lineStyle: {
            color: theme.borderMuted,
          },
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
          color: theme.textSecondary,
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
            formatter: (params) => {
              const triplet = getHeatmapTriplet(params.data);
              if (!triplet) return '';
              return formatValue(normalizeNumericValue(triplet[2]), props.panel.options.format || {});
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: theme.border,
            },
          },
        },
      ],
    };
  }
</script>

<style scoped lang="less">
  .dp-heatmap-chart {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;

    &__wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);
    }

    &__chart {
      flex: 1;
      width: 100%;
      min-height: 0;
    }
  }
</style>
