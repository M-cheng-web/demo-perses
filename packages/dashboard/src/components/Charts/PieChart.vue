<!-- 饼图 -->
<template>
  <div :class="bem()">
    <Spin v-if="isLoading" :class="bem('loading')" :spinning="true" />

    <div :class="bem('wrapper', { 'legend-right': legendOptions.position === 'right' })">
      <div ref="chartRef" :class="bem('chart')"></div>

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
  import type { EChartsOption, ECharts } from 'echarts';
  import type { Panel, QueryResult } from '@grafana-fast/types';
  import { formatValue, createNamespace } from '/#/utils';
  import { useChartResize } from '/#/composables/useChartResize';
  import { useLegend } from '/#/composables/useLegend';
  import { useChartInit } from '/#/composables/useChartInit';
  import { useChartTooltip, TooltipDataProviders, type TooltipData } from '/#/composables/useChartTooltip';
  import Legend from '/#/components/ChartLegend/Legend.vue';
  import { Spin } from '@grafana-fast/component';

  const [_, bem] = createNamespace('pie-chart');

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  /**
   * 使用图表初始化 Hook
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
    dataProvider: TooltipDataProviders.pie(
      () => props.queryResults,
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
      console.warn('Pie chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update pie chart:', error);
    }
  }

  const getChartOption = (): EChartsOption => {
    const { queryResults } = props;
    const { options } = props.panel;
    const specificOptions = options.specific as any;

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

    // 准备饼图数据
    const data: any[] = [];
    const colors = options.chart?.colors || [];
    let colorIndex = 0;

    queryResults.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries) => {
        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'series';
        const seriesId = `series-${colorIndex}`;

        // 获取该系列的显示状态
        const visibility = getSeriesVisibility(seriesId);

        // 如果是隐藏状态，直接跳过
        if (visibility === 'hidden') {
          colorIndex++;
          return;
        }

        // 取最后一个值
        const lastValue = timeSeries.values[timeSeries.values.length - 1];
        if (lastValue) {
          const color = colors[colorIndex % colors.length] || `hsl(${(colorIndex * 137.5) % 360}, 70%, 50%)`;
          const opacity = visibility === 'visible' ? 1 : 0.3;

          data.push({
            name: legend,
            value: lastValue[1],
            itemStyle: {
              color: color,
              opacity: opacity,
            },
          });
        }

        colorIndex++;
      });
    });

    // 如果没有数据，返回空配置
    if (data.length === 0) {
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

    const isPie = specificOptions?.pieType !== 'doughnut';

    return {
      // 启用 ECharts 原生 tooltip，用于获取准确的数据
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          if (!params || !params.data) {
            updateTooltipData(null);
            return '';
          }

          const seriesId = `series-${params.dataIndex}`;

          // 检查该系列是否被选中（未被隐藏）
          if (!isSeriesSelected(seriesId)) {
            updateTooltipData(null);
            return '';
          }

          const tooltipData: TooltipData = {
            time: params.name,
            series: [
              {
                id: seriesId,
                label: params.name,
                color: params.color,
                value: params.value,
                formattedValue: formatValue(params.value, options.format || {}),
                percent: params.percent,
              },
            ],
          };

          updateTooltipData(tooltipData);
          return ''; // 返回空字符串，我们使用自定义 Tooltip 展示
        },
      },
      legend: {
        show: false, // 使用自定义 Legend
      },
      grid: {
        left: 10,
        right: 10,
        bottom: 0,
        top: 0,
        containLabel: false,
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
    };
  };
</script>

<style scoped lang="less">
  .dp-pie-chart {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;

    &__loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10;
    }

    &__wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;

      // 当图例在右侧时，改为横向布局
      &--legend-right {
        flex-direction: row;

        .dp-pie-chart__chart {
          flex: 1;
          width: 0;
          min-width: 0;
        }
      }
    }

    &__chart {
      flex: 1;
      width: 100%;
      min-height: 0;
    }
  }
</style>
