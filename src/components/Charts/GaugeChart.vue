<template>
  <div ref="chartRef" class="gauge-chart"></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { EChartsType } from 'echarts/core';
  import type { Panel, QueryResult, GaugeOptions } from '@/types';
  import { formatValue } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const chartInstance = ref<EChartsType | null>(null);

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);

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

  // 根据阈值获取颜色
  const getColor = (value: number): string => {
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
  };

  const initChart = () => {
    if (!chartRef.value) return;

    // 只在有数据时才初始化图表
    if (!props.queryResults || props.queryResults.length === 0 || props.queryResults.every((r) => !r.data || r.data.length === 0)) {
      console.log('Waiting for data before initializing gauge chart');
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

  onMounted(() => {
    // 延迟初始化，等待数据到达
    nextTick(() => {
      initChart();
    });
  });

  onUnmounted(() => {
    chartInstance.value?.dispose();
    chartInstance.value = null;
  });
</script>

<style scoped lang="less">
  .gauge-chart {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }
</style>
