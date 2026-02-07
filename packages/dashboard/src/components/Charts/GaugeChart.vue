<!-- 仪表盘 -->
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
  import type { Panel, QueryResult, GaugeOptions } from '@grafana-fast/types';
  import { formatValue, createNamespace } from '/#/utils';
  import { useChartPanelLifecycle } from '/#/composables/useChartPanelLifecycle';
  import { getEChartsTheme } from '/#/utils/echartsTheme';

  const [_, bem] = createNamespace('gauge-chart');

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  const gaugeOptions = computed(() => (props.panel.options.specific as GaugeOptions) || {});
  const thresholdsConfig = computed(() => props.panel.options.thresholds || { steps: [], mode: 'absolute' as const });
  const formatOptions = computed(() => props.panel.options.format || {});

  /**
   * 根据计算方式获取值
   */
  const calculateValue = (values: [number, number][], calculation: string = 'last'): number => {
    if (!values || values.length === 0) return 0;

    switch (calculation) {
      case 'first':
        return values[0]?.[1] || 0;
      case 'last':
        return values[values.length - 1]?.[1] || 0;
      case 'mean': {
        const sum = values.reduce((acc, val) => acc + (val?.[1] || 0), 0);
        return sum / values.length;
      }
      case 'min':
        return Math.min(...values.map((val) => val?.[1] || 0));
      case 'max':
        return Math.max(...values.map((val) => val?.[1] || 0));
      default:
        return values[values.length - 1]?.[1] || 0;
    }
  };

  // 获取当前值
  const currentValue = computed(() => {
    if (!props.queryResults.length || !props.queryResults[0]?.data?.length) {
      return 0;
    }

    const timeSeries = props.queryResults[0].data[0];
    if (!timeSeries || !timeSeries.values?.length) {
      return 0;
    }

    return calculateValue(timeSeries.values, gaugeOptions.value.calculation || 'last');
  });

  useChartPanelLifecycle<ECharts>({
    chartRef,
    queryResults: computed(() => props.queryResults),
    panelOptions: computed(() => props.panel.options),
    onChartCreated: (instance) => {
      updateChart(instance);
    },
    onChartUpdated: (instance) => {
      updateChart(instance);
    },
  });

  /**
   * 更新图表配置和数据
   */
  function updateChart(instance?: ECharts | null) {
    const chartInst = instance;
    if (!chartInst) {
      console.warn('Gauge chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update gauge chart:', error);
    }
  }

  // 根据阈值获取颜色
  function getColor(value: number): string {
    const thresholds = thresholdsConfig.value.steps || [];
    if (!thresholds.length) {
      return '#356fcf';
    }

    // 过滤掉 value 为 null 的阈值，并按值排序
    const validThresholds = thresholds.filter((t: any) => t.value !== null).sort((a: any, b: any) => (a.value || 0) - (b.value || 0));

    // 找到适用的阈值
    for (let i = validThresholds.length - 1; i >= 0; i--) {
      const threshold = validThresholds[i];
      if (threshold && value >= (threshold.value || 0)) {
        return threshold.color;
      }
    }

    // 如果没有匹配的阈值，返回 Default 的颜色或第一个阈值的颜色
    const defaultThreshold = thresholds.find((t: any) => t.value === null);
    if (defaultThreshold) {
      return defaultThreshold.color;
    }

    const firstThreshold = validThresholds[0];
    return firstThreshold?.color || getEChartsTheme().palette[0] || '#356fcf';
  }

  function getChartOption(): EChartsOption {
    const theme = getEChartsTheme(chartRef.value);
    const min = gaugeOptions.value.min ?? 0;
    const max = gaugeOptions.value.max ?? 100;
    const startAngle = gaugeOptions.value.startAngle ?? 225;
    const endAngle = gaugeOptions.value.endAngle ?? -45;
    const splitNumber = gaugeOptions.value.splitNumber ?? 10;
    const pointer = gaugeOptions.value.pointer ?? { show: true, length: '60%', width: 8 };
    const value = currentValue.value;
    const color = getColor(value);

    // 构建仪表盘颜色区间
    const axisLine: any = {
      lineStyle: {
        width: 30,
      },
    };

    const thresholds = thresholdsConfig.value.steps || [];
    if (thresholds.length > 0) {
      // 按值排序阈值
      const validThresholds = [...thresholds].sort((a: any, b: any) => (a.value || 0) - (b.value || 0));

      if (validThresholds.length > 0) {
        const colorStops: [number, string][] = [];

        // 添加各个阈值的颜色
        validThresholds.forEach((threshold: any) => {
          const percent = ((threshold.value || 0) - min) / (max - min);
          if (percent >= 0 && percent <= 1) {
            colorStops.push([percent, threshold.color]);
          }
        });

        // 确保最后一个颜色延伸到 100%
        if (colorStops.length > 0) {
          const lastStop = colorStops[colorStops.length - 1];
          if (lastStop && lastStop[0] < 1) {
            colorStops.push([1, lastStop[1]]);
          }
        }

        // 如果第一个阈值不是从0开始，补充起始颜色
        if (colorStops.length > 0 && colorStops[0] && colorStops[0][0] > 0) {
          colorStops.unshift([0, colorStops[0][1]]);
        }

        axisLine.lineStyle.color = colorStops;
      } else {
        axisLine.lineStyle.color = [[1, color]];
      }
    } else {
      axisLine.lineStyle.color = [[1, color]];
    }

    return {
      ...theme.baseOption,
      // 禁用动画，减少高频刷新时的视觉抖动
      animation: false,
      series: [
        {
          type: 'gauge',
          min,
          max,
          startAngle,
          endAngle,
          splitNumber,
          radius: '75%',
          center: ['50%', '50%'],
          axisLine,
          pointer: {
            show: pointer.show !== false,
            length: pointer.length || '60%',
            width: pointer.width || 8,
            itemStyle: {
              color: 'inherit',
            },
          },
          axisTick: {
            distance: -30,
            length: 8,
            lineStyle: {
              color: theme.borderMuted,
              width: 1,
            },
          },
          splitLine: {
            distance: 6,
            length: 15,
            lineStyle: {
              color: theme.borderMuted,
              width: 2,
            },
          },
          axisLabel: {
            distance: -45,
            color: theme.textSecondary,
            fontSize: 11,
            formatter: (value: number) => {
              return formatValue(value, formatOptions.value || {});
            },
          },
          detail: {
            valueAnimation: true,
            formatter: (value: number) => {
              return formatValue(value, formatOptions.value || {});
            },
            color: 'inherit',
            fontSize: 28,
            fontWeight: 'bold',
            offsetCenter: [0, '70%'],
          },
          data: [{ value }],
        },
      ],
    };
  }
</script>

<style scoped lang="less">
  .dp-gauge-chart {
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
