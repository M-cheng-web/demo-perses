<!-- 仪表盘 -->
<template>
  <div class="gauge-chart-container">
    <Spin v-if="isLoading" class="loading-spinner" :spinning="true" />

    <div class="chart-wrapper">
      <div ref="chartRef" class="gauge-chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick } from 'vue';
  import { Spin } from 'ant-design-vue';
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult, GaugeOptions } from '@/types';
  import { formatValue } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';
  import { useChartInit } from '@/composables/useChartInit';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  const gaugeOptions = computed(() => (props.panel.options.specific as GaugeOptions) || {});

  // 获取最后一个值
  const currentValue = computed(() => {
    if (!props.queryResults.length || !props.queryResults[0]?.data?.length) {
      return 0;
    }

    const timeSeries = props.queryResults[0].data[0];
    if (!timeSeries || !timeSeries.values?.length) {
      return 0;
    }

    const lastValue = timeSeries.values[timeSeries.values.length - 1];
    return lastValue ? lastValue[1] : 0;
  });

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
        initChartResize();
      });
    },
    onUpdate: (instance) => {
      nextTick(() => {
        updateChart(instance);
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
    const thresholds = gaugeOptions.value.thresholds || [];
    if (!thresholds.length) {
      return '#5470c6';
    }

    // 按值排序阈值
    const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);

    // 找到适用的阈值
    for (let i = sortedThresholds.length - 1; i >= 0; i--) {
      const threshold = sortedThresholds[i];
      if (threshold && value >= threshold.value) {
        return threshold.color;
      }
    }

    const firstThreshold = sortedThresholds[0];
    return firstThreshold?.color || '#5470c6';
  }

  function getChartOption(): EChartsOption {
    const min = gaugeOptions.value.min ?? 0;
    const max = gaugeOptions.value.max ?? 100;
    const value = currentValue.value;
    const color = getColor(value);

    // 构建仪表盘颜色区间
    const axisLine: any = {
      lineStyle: {
        width: 30,
      },
    };

    if (gaugeOptions.value.thresholds && gaugeOptions.value.thresholds.length > 0) {
      const sortedThresholds = [...gaugeOptions.value.thresholds].sort((a, b) => a.value - b.value);
      const colorStops: [number, string][] = [];

      sortedThresholds.forEach((threshold, index) => {
        const percent = (threshold.value - min) / (max - min);
        colorStops.push([percent, threshold.color]);

        if (index === sortedThresholds.length - 1 && percent < 1) {
          colorStops.push([1, threshold.color]);
        }
      });

      if (colorStops.length > 0) {
        const firstStop = colorStops[0];
        if (firstStop && firstStop[0] > 0) {
          colorStops.unshift([0, firstStop[1]]);
        }
      }

      axisLine.lineStyle.color = colorStops;
    } else {
      axisLine.lineStyle.color = [[1, color]];
    }

    return {
      series: [
        {
          type: 'gauge',
          min,
          max,
          splitNumber: 5,
          radius: '80%',
          axisLine,
          pointer: {
            show: gaugeOptions.value.showPointer !== false,
            length: '60%',
            width: 8,
            itemStyle: {
              color: 'auto',
            },
          },
          axisTick: {
            distance: -30,
            length: 8,
            lineStyle: {
              color: '#fff',
              width: 2,
            },
          },
          splitLine: {
            distance: -30,
            length: 15,
            lineStyle: {
              color: '#fff',
              width: 4,
            },
          },
          axisLabel: {
            distance: 10,
            color: 'auto',
            fontSize: 12,
            formatter: (value: number) => {
              return formatValue(value, props.panel.options.format || {});
            },
          },
          detail: {
            valueAnimation: true,
            formatter: (value: number) => {
              return formatValue(value, props.panel.options.format || {});
            },
            color: 'auto',
            fontSize: 24,
            fontWeight: 'bold',
            offsetCenter: [0, '60%'],
          },
          data: [{ value }],
        },
      ],
    };
  }
</script>

<style scoped lang="less">
  .gauge-chart-container {
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

  .gauge-chart {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
</style>
