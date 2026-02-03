<!-- 统计图 -->
<template>
  <div :class="bem()">
    <Spin v-if="isLoading" :class="bem('loading')" :spinning="true" />

    <div :class="bem('wrapper')">
      <div :class="bem('content')" :style="contentStyle">
        <div :class="bem('value')">{{ formattedValue }}</div>
        <div v-if="showName" :class="bem('name')">{{ panel.name }}</div>
        <div v-if="showTrend" :class="[bem('trend'), trendClass]">
          <component :is="trendIcon" />
          <span>{{ trendText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, h } from 'vue';
  import { Spin } from '@grafana-fast/component';
  import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons-vue';
  import type { Panel, QueryResult } from '@grafana-fast/types';
  import { formatValue, createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('stat-panel');

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
  .dp-stat-panel {
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
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      min-height: 0;
      padding: 24px;
    }

    &__content {
      display: flex;
      gap: 8px;
    }

    &__value {
      font-size: 36px;
      font-weight: 600;
      color: var(--gf-color-text);
      line-height: 1.2;
      letter-spacing: -0.02em;
      font-feature-settings: 'tnum';
      font-variant-numeric: tabular-nums;
    }

    &__name {
      font-size: 14px;
      color: var(--gf-color-text-secondary);
      margin-top: 8px;
      line-height: 1.5714285714285714;
    }

    &__trend {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      font-weight: 500;
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: var(--gf-radius-sm);
      transition: all var(--gf-motion-fast) var(--gf-easing);

      &.trend-up {
        color: var(--gf-color-success);
        background: var(--gf-color-success-soft);
      }

      &.trend-down {
        color: var(--gf-color-danger);
        background: var(--gf-color-danger-soft);
      }

      &.trend-neutral {
        color: var(--gf-color-text-tertiary);
        background: var(--gf-color-fill-tertiary);
      }
    }
  }
</style>
