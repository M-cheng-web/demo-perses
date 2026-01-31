<!-- 柱状图 -->
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
  import { getEChartsTheme } from '/#/utils/echartsTheme';

  const [_, bem] = createNamespace('bar-chart');

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const chartRef = ref<HTMLElement>();

  // 生成唯一的图表 ID
  const chartId = computed(() => `chart-${props.panel.id}`);

  /**
   * 使用图表初始化 Hook
   * 等待 queryResults 和 panel.options 都有效后才初始化一次
   */
  const { getInstance, isLoading } = useChartInit<ECharts>({
    chartRef,
    dependencies: [
      {
        value: computed(() => props.queryResults),
        isValid: (val: unknown) => {
          const results = Array.isArray(val) ? (val as QueryResult[]) : [];
          return results.length > 0 && results.some((r) => Array.isArray(r.data) && r.data.length > 0);
        },
      },
      {
        value: computed(() => props.panel.options),
        // Options can be an empty object; charts should still render with defaults.
        isValid: (val: unknown) => val != null,
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
    dataProvider: TooltipDataProviders.bar(
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
      console.warn('Bar chart instance not initialized, skipping update');
      return;
    }

    try {
      const option = getChartOption();
      chartInst.setOption(option, true);
    } catch (error) {
      console.error('Failed to update bar chart:', error);
    }
  }

  const getChartOption = (): EChartsOption => {
    const { queryResults } = props;
    const { options } = props.panel;
    const theme = getEChartsTheme(chartRef.value);

    // 检查是否有有效数据
    if (!queryResults || queryResults.length === 0 || queryResults.every((r) => !r.data || r.data.length === 0)) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: theme.textSecondary,
            fontSize: 14,
          },
        },
      };
    }

    // 准备系列数据
    const series: any[] = [];
    const colors = options.chart?.colors && options.chart.colors.length > 0 ? options.chart.colors : theme.palette;
    let colorIndex = 0;

    const specificOptions = options.specific as any;
    const isHorizontal = specificOptions?.orientation === 'horizontal';

    // 收集所有时间点作为类目
    const categories = new Set<number>();
    queryResults.forEach((result) => {
      if (!result.data) return;

      result.data.forEach((timeSeries) => {
        if (!timeSeries || !timeSeries.values) return;

        timeSeries.values.forEach(([timestamp]) => {
          categories.add(timestamp);
        });
      });
    });

    const sortedCategories = Array.from(categories).sort((a, b) => a - b);

    // 将时间戳转换为日期字符串
    const categoryLabels = sortedCategories.map((ts) => {
      const date = new Date(ts);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    // 如果没有数据，返回空配置
    if (sortedCategories.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: theme.textSecondary,
            fontSize: 14,
          },
        },
      };
    }

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

        // 为每个时间点创建数据
        const dataMap = new Map(timeSeries.values.map(([timestamp, value]) => [timestamp, value]));
        const data = sortedCategories.map((ts) => dataMap.get(ts) ?? 0);

        const color = colors[colorIndex % colors.length] || theme.palette[colorIndex % theme.palette.length] || theme.textSecondary;

        // 根据可见性状态设置透明度
        const opacity = visibility === 'visible' ? 1 : 0.08;

        series.push({
          id: seriesId,
          name: legend,
          type: 'bar',
          data,
          barWidth: specificOptions?.barWidth || 'auto',
          stack: specificOptions?.barMode === 'stack' ? 'total' : undefined,
          // 控制可见性
          itemStyle: {
            color: color,
            opacity: opacity,
          },
          emphasis: {
            focus: 'series',
          },
        });

        colorIndex++;
      });
    });

    const axisLabel = {
      color: theme.textSecondary,
      formatter: (value: number) => formatValue(value, options.format || {}),
    };

    const axisLine = { lineStyle: { color: theme.borderMuted } };
    const splitLine = { show: true, lineStyle: { color: theme.borderMuted } };

    // 如果没有系列数据，返回空配置
    if (series.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: theme.textSecondary,
            fontSize: 14,
          },
        },
      };
    }

    return {
      ...theme.baseOption,
      // 启用 ECharts 原生 tooltip，用于获取准确的数据
      tooltip: {
        ...theme.baseOption.tooltip,
        trigger: 'axis',
        triggerOn: 'mousemove',
        axisPointer: {
          type: 'shadow',
          lineStyle: axisLine.lineStyle,
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
            time: firstParam.axisValueLabel || firstParam.name,
            series: visibleParams.map((param: any) => ({
              id: param.seriesId || `series-${param.seriesIndex}`,
              label: param.seriesName,
              color: param.color,
              value: param.value,
              formattedValue: formatValue(param.value, options.format || {}),
            })),
          };

          updateTooltipData(tooltipData);
          return ''; // 返回空字符串，我们使用自定义 Tooltip 展示
        },
      },
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
      xAxis: isHorizontal
        ? {
            type: 'value',
            show: options.axis?.xAxis?.show ?? true,
            name: options.axis?.xAxis?.name,
            axisLabel,
            axisLine,
            splitLine,
          }
        : {
            type: 'category',
            data: categoryLabels,
            show: options.axis?.xAxis?.show ?? true,
            name: options.axis?.xAxis?.name,
            axisLabel: { color: theme.textSecondary },
            axisLine,
          },
      yAxis: isHorizontal
        ? {
            type: 'category',
            data: categoryLabels,
            show: options.axis?.yAxis?.show ?? true,
            name: options.axis?.yAxis?.name,
            axisLabel: { color: theme.textSecondary },
            axisLine,
          }
        : {
            type: 'value',
            show: options.axis?.yAxis?.show ?? true,
            name: options.axis?.yAxis?.name,
            min: options.axis?.yAxis?.min,
            max: options.axis?.yAxis?.max,
            axisLabel,
            axisLine,
            splitLine,
          },
      series,
    };
  };
</script>

<style scoped lang="less">
  .dp-bar-chart {
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

        .dp-bar-chart__chart {
          flex: 1;
          width: 0; // 重要：让 flex 能正确计算宽度
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
