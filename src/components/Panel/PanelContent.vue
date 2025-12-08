<template>
  <div class="panel-content">
    <Spin v-if="loading" class="loading-spinner" :spinning="true" tip="加载中..." />

    <div class="panel-content-wrapper">
      <div v-if="error" class="panel-error">
        <Result status="error" :title="error" />
      </div>
      <component v-else-if="chartComponent" :is="chartComponent" :panel="panel" :query-results="queryResults" />
      <div v-else class="panel-empty">
        <Empty description="未配置图表类型" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onMounted } from 'vue';
  import { Spin, Result, Empty } from 'ant-design-vue';
  import { storeToRefs } from 'pinia';
  import type { Panel, QueryResult } from '@/types';
  import { useTimeRangeStore } from '@/stores';
  import { mockDataManager } from '@/mock';
  import { PanelType } from '@/enums/panelType';
  import TimeSeriesChart from '@/components/Charts/TimeSeriesChart.vue';
  import PieChart from '@/components/Charts/PieChart.vue';
  import BarChart from '@/components/Charts/BarChart.vue';
  import StatPanel from '@/components/Charts/StatPanel.vue';
  import TableChart from '@/components/Charts/TableChart.vue';
  import GaugeChart from '@/components/Charts/GaugeChart.vue';
  import HeatmapChart from '@/components/Charts/HeatmapChart.vue';

  const props = defineProps<{
    panel: Panel;
  }>();

  const timeRangeStore = useTimeRangeStore();
  const { absoluteTimeRange } = storeToRefs(timeRangeStore);

  const loading = ref(false);
  const error = ref('');
  const queryResults = ref<QueryResult[]>([]);

  // 根据面板类型选择组件
  const chartComponent = computed(() => {
    const typeMap: Record<string, any> = {
      [PanelType.TIMESERIES]: TimeSeriesChart,
      [PanelType.BAR]: BarChart,
      [PanelType.PIE]: PieChart,
      [PanelType.STAT]: StatPanel,
      [PanelType.TABLE]: TableChart,
      [PanelType.GAUGE]: GaugeChart,
      [PanelType.HEATMAP]: HeatmapChart,
    };
    return typeMap[props.panel.type];
  });

  // 执行查询
  const executeQueries = async () => {
    if (!props.panel.queries || props.panel.queries.length === 0) {
      queryResults.value = [];
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      const absRange = absoluteTimeRange.value;
      const results = await mockDataManager.executeQueries(props.panel.queries, {
        from: absRange.from,
        to: absRange.to,
      });
      queryResults.value = results;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '查询失败';
      console.error('Query execution failed:', err);
    } finally {
      loading.value = false;
    }
  };

  // 监听时间范围和查询变化
  watch([absoluteTimeRange, () => props.panel.queries], executeQueries, { deep: true });

  onMounted(() => {
    executeQueries();
  });
</script>

<style scoped lang="less">
  .panel-content {
    position: relative;
    flex: 1;
    padding: @spacing-sm-2;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }

  .panel-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    height: 100%;
  }

  .panel-error,
  .panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
</style>
