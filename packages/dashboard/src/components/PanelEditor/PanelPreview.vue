<!-- 图表预览 -->
<template>
  <div :class="bem()">
	    <div :class="bem('content')">
      <div v-if="showHeader" :class="bem('header')">
        <div :class="bem('title')">预览</div>
      </div>
      <component v-if="panel && queryResults.length > 0" :is="chartComponent" :panel="panel" :query-results="queryResults" />
      <Empty v-else description="暂无数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
	  import { ref, computed, watch, onMounted } from 'vue';
	  import { Empty } from '@grafana-fast/component';
	  import TimeSeriesChart from '/#/components/Charts/TimeSeriesChart.vue';
	  import PieChart from '/#/components/Charts/PieChart.vue';
	  import BarChart from '/#/components/Charts/BarChart.vue';
  import StatPanel from '/#/components/Charts/StatPanel.vue';
  import GaugeChart from '/#/components/Charts/GaugeChart.vue';
  import HeatmapChart from '/#/components/Charts/HeatmapChart.vue';
  import TableChart from '/#/components/Charts/TableChart.vue';
  import type { Panel, QueryResult } from '@grafana-fast/types';
  import { useTimeRangeStore } from '/#/stores';
  import { executeQueries } from '/#/mock/queries';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('panel-preview');

  const props = withDefaults(
    defineProps<{
      panel: Panel;
      autoExecute?: boolean; // 是否自动执行查询
      showHeader?: boolean;
    }>(),
    {
      autoExecute: true, // 默认自动执行，保持向后兼容
      showHeader: true,
    }
  );

  const timeRangeStore = useTimeRangeStore();
  const queryResults = ref<QueryResult[]>([]);
	  const isLoading = ref(false);

  // 根据面板类型选择对应的图表组件
  const chartComponent = computed(() => {
    const componentMap: Record<string, any> = {
      timeseries: TimeSeriesChart,
      pie: PieChart,
      bar: BarChart,
      stat: StatPanel,
      gauge: GaugeChart,
      heatmap: HeatmapChart,
      table: TableChart,
    };
    return componentMap[props.panel.type] || TimeSeriesChart;
  });

  // 执行查询（使用和外部一样的查询逻辑，确保数据一致）
  const executeQueriesInternal = async () => {
    if (!props.panel.queries || props.panel.queries.length === 0) {
      queryResults.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const { start, end } = timeRangeStore.getTimeRangeTimestamps();
      const timeRange = { from: start, to: end };

      // 使用和外部一样的 executeQueries 函数，确保数据来源一致
      const results = await executeQueries(props.panel.queries, timeRange);

      queryResults.value = results;
    } catch (error) {
      console.error('Query execution failed:', error);
      queryResults.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 监听面板变化（包括查询、选项等）
  watch(
    () => props.panel,
    () => {
      if (props.autoExecute) {
        executeQueriesInternal();
      }
    },
    { deep: true, immediate: false }
  );

  // 监听面板类型变化
  watch(
    () => props.panel.type,
    () => {
      if (queryResults.value.length > 0) {
        // 重新渲染
        const temp = queryResults.value;
        queryResults.value = [];
        setTimeout(() => {
          queryResults.value = temp;
        }, 0);
      }
    }
  );

  // 监听时间范围变化
  watch(
    () => timeRangeStore.timeRange,
    () => {
      if (props.autoExecute) {
        executeQueriesInternal();
      }
    },
    { deep: true }
  );

  onMounted(() => {
    if (props.autoExecute) {
      executeQueriesInternal();
    }
  });

  // 暴露方法给父组件调用
  defineExpose({
    executeQueries: executeQueriesInternal,
  });
</script>

<style scoped lang="less">
  .dp-panel-preview {
    &__header {
      position: absolute;
      top: 10px;
      left: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: var(--gf-radius-sm);
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-raised);
      box-shadow: var(--gf-shadow-1);
      pointer-events: none;
    }

    &__content {
      height: 300px;
      position: relative;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      overflow: hidden;
    }

    &__title {
      font-size: 12px;
      font-weight: 650;
      color: var(--gf-color-text-secondary);
      line-height: 1;
    }
  }
</style>
