<!-- 时间序列图 -->
<template>
  <div class="time-series-chart-container">
    <a-spin :spinning="isLoading">
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
  import ChartTooltip from '@/components/ChartTooltip/ChartTooltip.vue';
  import Legend from '@/components/ChartLegend/Legend.vue';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();
  const tooltipRef = ref();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  // 时间序列数据
  const timeSeriesData = computed(() => {
    return props.queryResults.flatMap((result) => result.data);
  });

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
    onChartCreated: (instance) => {
      // 绑定事件到 ZRender 层，以支持 Tooltip
      const zr = instance.getZr();

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
    },
    onUpdate: (instance) => {
      nextTick(() => {
        updateChart(instance);
      });
    },
  });

  /**
   * 更新图表配置和数据
   */
  function updateChart(instance?: ECharts) {
    const chartInst = instance || chartInstance.value;
    if (!chartInst) {
      console.warn('Chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      console.log('Updating chart with option:', option);
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update chart:', error);
    }
  }

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

  function getChartOption(): EChartsOption {
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

        // 获取该系列的显示状态
        const visibility = getSeriesVisibility(seriesId);

        // 如果是隐藏状态，直接跳过，不添加到 series 中
        if (visibility === 'hidden') {
          colorIndex++;
          return;
        }

        const data = timeSeries.values.map(([timestamp, value]) => [timestamp, value]);

        const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;

        // 根据可见性状态设置透明度
        const opacity = visibility === 'visible' ? 1 : 0.08;
        const areaOpacity = visibility === 'visible' ? 0.3 : 0.03;

        series.push({
          id: seriesId,
          name: legend,
          type: specificOptions?.mode === 'bar' ? 'bar' : 'line',
          data,
          smooth: options.chart?.smooth ?? true, // 平滑曲线
          showSymbol: options.chart?.showSymbol ?? false, // 显示数据点

          // 堆叠图必须有 areaStyle 才能显示堆叠效果
          areaStyle: {
            opacity: areaOpacity,
          },
          // 控制可见性
          silent: false,
          // 线条样式
          lineStyle: {
            width: options.chart?.line?.width ?? 2,
            type: options.chart?.line?.type ?? 'solid',
            color: color,
            opacity: opacity,
          },
          // 数据点样式
          itemStyle: {
            color: color,
            opacity: opacity,
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
        // max: options.axis?.yAxis?.max,
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
  }

  // 使用响应式 resize
  useChartResize(chartInstance, chartRef);
</script>

<style scoped lang="less">
  .time-series-chart-container {
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

  .time-series-chart {
    flex: 1;
    width: 100%;
    min-height: 200px;
  }
</style>
