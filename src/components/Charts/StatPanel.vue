<!-- 统计图 -->
<template>
  <div class="stat-panel-container">
    <Spin v-if="isLoading" class="loading-spinner" :spinning="true" />

    <div class="stat-wrapper">
      <div class="stat-content" :style="contentStyle">
        <div class="stat-value">{{ formattedValue }}</div>
        <div v-if="showName" class="stat-name">{{ panel.name }}</div>
        <div v-if="showTrend" class="stat-trend" :class="trendClass">
          <component :is="trendIcon" />
          <span>{{ trendText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, h } from 'vue';
  import { Spin } from 'ant-design-vue';
  import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons-vue';
  import type { Panel, QueryResult } from '@/types';
  import { formatValue } from '@/utils';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const specificOptions = computed(() => props.panel.options.specific as any);
  const formatOptions = computed(() => props.panel.options.format || {});

  // 判断是否正在加载
  const isLoading = computed(() => {
    return !props.queryResults || props.queryResults.length === 0;
  });

  // 获取当前值
  const currentValue = computed(() => {
    if (props.queryResults.length === 0) return 0;

    const firstResult = props.queryResults[0];
    if (!firstResult?.data || firstResult.data.length === 0) return 0;

    const firstSeries = firstResult.data[0];
    if (!firstSeries?.values || firstSeries.values.length === 0) return 0;

    const lastValue = firstSeries.values[firstSeries.values.length - 1];
    return lastValue ? lastValue[1] : 0;
  });

  // 格式化的值
  const formattedValue = computed(() => {
    return formatValue(currentValue.value, formatOptions.value);
  });

  // 是否显示名称
  const showName = computed(() => {
    return specificOptions.value?.displayMode === 'value-and-name';
  });

  // 是否显示趋势
  const showTrend = computed(() => {
    return specificOptions.value?.showTrend && props.queryResults.length > 0;
  });

  // 趋势计算
  const trend = computed(() => {
    if (props.queryResults.length === 0) return 0;

    const firstResult = props.queryResults[0];
    if (!firstResult?.data || firstResult.data.length === 0) return 0;

    const firstSeries = firstResult.data[0];
    if (!firstSeries?.values || firstSeries.values.length < 2) return 0;

    const values = firstSeries.values;
    const currentVal = values[values.length - 1];
    const previousVal = values[values.length - 2];

    if (!currentVal || !previousVal) return 0;

    return currentVal[1] - previousVal[1];
  });

  const trendClass = computed(() => {
    if (trend.value > 0) return 'trend-up';
    if (trend.value < 0) return 'trend-down';
    return 'trend-neutral';
  });

  const trendIcon = computed(() => {
    if (trend.value > 0) return h(ArrowUpOutlined);
    if (trend.value < 0) return h(ArrowDownOutlined);
    return h(MinusOutlined);
  });

  const trendText = computed(() => {
    return Math.abs(trend.value).toFixed(2);
  });

  const alignItemsMap: any = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  // 内容样式
  const contentStyle = computed(() => {
    const orientation = specificOptions.value?.orientation || 'vertical';
    const textAlign = specificOptions.value?.textAlign || 'center';

    return {
      flexDirection: orientation === 'horizontal' ? ('row' as const) : ('column' as const),
      alignItems: (orientation === 'horizontal' ? 'center' : alignItemsMap[textAlign] || 'center') as string,
      // textAlign: textAlign as 'left' | 'center' | 'right',
    };
  });
</script>

<style scoped lang="less">
  .stat-panel-container {
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

  .stat-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: @spacing-lg;
  }

  .stat-content {
    display: flex;
    gap: @spacing-sm;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.85);
    line-height: 1.2;
  }

  .stat-name {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: @spacing-xs;
  }

  .stat-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 500;
    margin-top: @spacing-xs;

    &.trend-up {
      color: #52c41a;
    }

    &.trend-down {
      color: #f5222d;
    }

    &.trend-neutral {
      color: rgba(0, 0, 0, 0.45);
    }
  }
</style>
