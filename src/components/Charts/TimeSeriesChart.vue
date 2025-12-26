<!-- 时间序列图 -->
<template>
  <div class="time-series-chart-container">
    <Spin v-if="isLoading" class="loading-spinner" :spinning="true" />

    <div class="chart-wrapper" :class="{ 'is-legend-right': legendOptions.position === 'right' }">
      <div ref="chartRef" class="time-series-chart"></div>

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
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick } from 'vue';
  import { Spin } from 'ant-design-vue';
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult } from '@/types';
  import { formatValue, formatTime } from '@/utils';
  import { useChartResize } from '@/composables/useChartResize';
  import { useLegend } from '@/composables/useLegend';
  import { useChartInit } from '@/composables/useChartInit';
  import { useChartTooltip, TooltipDataProviders, type TooltipData } from '@/composables/useChartTooltip';
  import Legend from '@/components/ChartLegend/Legend.vue';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  // 时间序列数据
  const timeSeriesData = computed(() => {
    const data = props.queryResults.flatMap((result) => result.data);
    return data;
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

  // 使用 Legend Hook
  const {
    selectedItems,
    legendItems,
    legendOptions,
    globalSelectionState,
    isSeriesSelected,
    getSeriesVisibility,
    handleLegendClick,
    handleLegendHover,
    handleLegendLeave,
    toggleGlobalSelection,
  } = useLegend({
    panel: computed(() => props.panel),
    queryResults: computed(() => props.queryResults),
    chartInstance: computed(() => getInstance()),
    updateChart: () => updateChart(getInstance()),
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
    dataProvider: TooltipDataProviders.timeSeries(
      () => timeSeriesData.value,
      () => props.panel.options.format,
      isSeriesSelected
    ),
  });

  /**
   * 更新图表配置和数据
   */
  function updateChart(instance?: ECharts | null) {
    const chartInst = instance;
    if (!chartInst) {
      console.warn('Chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update chart:', error);
    }
  }

  function getChartOption(): EChartsOption {
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
        // 使用配置中的填充透明度
        const baseFillOpacity = specificOptions?.fillOpacity ?? 0.3;
        const areaOpacity = visibility === 'visible' ? baseFillOpacity : baseFillOpacity * 0.1;

        const seriesConfig: any = {
          id: seriesId,
          name: legend,
          type: specificOptions?.mode === 'bar' ? 'bar' : 'line',
          data,
          // smooth: options.chart?.smooth ?? true, // 平滑曲线
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
        };

        // 堆叠配置：为柱状图和折线图添加堆叠支持
        if (specificOptions?.stackMode && specificOptions.stackMode !== 'none') {
          seriesConfig.stack = 'total'; // 所有系列使用相同的 stack 值才能堆叠
          // 百分比堆叠
          if (specificOptions.stackMode === 'percent') {
            seriesConfig.stack = 'percent';
          }
        }

        series.push(seriesConfig);

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
      // 启用 ECharts 原生 tooltip，用于获取准确的数据
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove',
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
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) {
            updateTooltipData(null);
            return '';
          }

          // 过滤掉隐藏的系列
          const visibleParams = params.filter((param: any) => isSeriesSelected(param.seriesId || `series-${param.seriesIndex}`));
          if (visibleParams.length === 0) {
            updateTooltipData(null);
            return '';
          }

          const firstParam = visibleParams[0];
          const tooltipData: TooltipData = {
            time: formatTime(firstParam.axisValue, 'YYYY-MM-DD HH:mm:ss'),
            series: visibleParams.map((param: any) => ({
              id: param.seriesId || `series-${param.seriesIndex}`,
              label: param.seriesName,
              color: param.color,
              value: param.value[1],
              formattedValue: formatValue(param.value[1], options.format || {}),
            })),
          };

          updateTooltipData(tooltipData);
          return ''; // 返回空字符串，我们使用自定义 Tooltip 展示
        },
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
</script>

<style scoped lang="less">
  .time-series-chart-container {
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

    // 当图例在右侧时，改为横向布局
    &.is-legend-right {
      flex-direction: row;

      .time-series-chart {
        flex: 1;
        width: 0; // 重要：让 flex 能正确计算宽度
        min-width: 0;
      }
    }
  }

  .time-series-chart {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
</style>
