<template>
  <div class="panel-preview">
    <div class="preview-header">
      <h4>预览</h4>
    </div>
    <div class="preview-content" ref="previewRef">
      <component v-if="panel && queryResults.length > 0" :is="chartComponent" :panel="panel" :query-results="queryResults" />
      <a-empty v-else description="暂无数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { Empty as AEmpty } from 'ant-design-vue';
  import TimeSeriesChart from '@/components/Charts/TimeSeriesChart.vue';
  import PieChart from '@/components/Charts/PieChart.vue';
  import StatPanel from '@/components/Charts/StatPanel.vue';
  import GaugeChart from '@/components/Charts/GaugeChart.vue';
  import HeatmapChart from '@/components/Charts/HeatmapChart.vue';
  import TableChart from '@/components/Charts/TableChart.vue';
  import type { Panel, QueryResult } from '@/types';
  import { useTimeRangeStore } from '@/stores';
  import { queryPrometheus } from '@/api/prometheus';

  const props = defineProps<{
    panel: Panel;
  }>();

  const timeRangeStore = useTimeRangeStore();
  const queryResults = ref<QueryResult[]>([]);
  const previewRef = ref<HTMLElement>();
  const isLoading = ref(false);

  // 根据面板类型选择对应的图表组件
  const chartComponent = computed(() => {
    const componentMap: Record<string, any> = {
      timeseries: TimeSeriesChart,
      pie: PieChart,
      stat: StatPanel,
      gauge: GaugeChart,
      heatmap: HeatmapChart,
      table: TableChart,
    };
    return componentMap[props.panel.type] || TimeSeriesChart;
  });

  // 执行查询
  const executeQueries = async () => {
    if (!props.panel.queries || props.panel.queries.length === 0) {
      queryResults.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const { start, end } = timeRangeStore.getTimeRangeTimestamps();
      const results = await Promise.all(
        props.panel.queries.map((query) =>
          queryPrometheus({
            query: query.expr,
            start,
            end,
            step: query.minStep || 15,
          })
        )
      );

      queryResults.value = results.map((result, index) => ({
        id: props.panel.queries[index]!.id,
        data: result,
      }));
    } catch (error) {
      console.error('Query execution failed:', error);
      queryResults.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 监听面板查询变化
  watch(
    () => props.panel.queries,
    () => {
      executeQueries();
    },
    { deep: true }
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

  onMounted(() => {
    executeQueries();
  });
</script>

<style scoped lang="less">
  .panel-preview {
    border: 1px solid @border-color;
    border-radius: @border-radius;
    background: @background-light;
    overflow: hidden;

    .preview-header {
      padding: @spacing-sm @spacing-md;
      background: @background-base;
      border-bottom: 1px solid @border-color;

      h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
      }
    }

    .preview-content {
      height: 300px;
      padding: @spacing-md;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
