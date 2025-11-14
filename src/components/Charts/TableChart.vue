<template>
  <div class="table-chart">
    <a-table :columns="columns" :data-source="dataSource" :pagination="paginationConfig" :scroll="{ y: 'calc(100% - 55px)' }" size="small">
      <template #bodyCell="{ column, text }">
        <template v-if="column.key !== 'time'">
          {{ formatValue(text, panel.options.format || {}) }}
        </template>
        <template v-else>
          {{ text }}
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { TableColumnType } from 'ant-design-vue';
  import type { Panel, QueryResult, TableOptions } from '@/types';
  import { formatValue, formatTime } from '@/utils';

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const tableOptions = computed(() => (props.panel.options.specific as TableOptions) || {});

  const columns = computed<TableColumnType[]>(() => {
    if (!props.queryResults.length || !props.queryResults[0]?.data?.length) {
      return [];
    }

    const cols: TableColumnType[] = [
      {
        title: '时间',
        dataIndex: 'time',
        key: 'time',
        width: 180,
        sorter:
          tableOptions.value.sortable !== false
            ? (a: any, b: any) => {
                return new Date(a.time).getTime() - new Date(b.time).getTime();
              }
            : undefined,
      },
    ];

    // 添加所有指标列
    const metricColumns = new Set<string>();
    props.queryResults.forEach((result) => {
      result.data.forEach((timeSeries) => {
        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'value';
        metricColumns.add(legend);
      });
    });

    metricColumns.forEach((metric) => {
      cols.push({
        title: metric,
        dataIndex: metric,
        key: metric,
        sorter:
          tableOptions.value.sortable !== false
            ? (a: any, b: any) => {
                return (a[metric] || 0) - (b[metric] || 0);
              }
            : undefined,
      });
    });

    return cols;
  });

  const dataSource = computed(() => {
    if (!props.queryResults.length) return [];

    // 构建时间戳到数据的映射
    const timeMap = new Map<number, any>();

    props.queryResults.forEach((result) => {
      result.data.forEach((timeSeries) => {
        const legend = timeSeries.metric.__legend__ || timeSeries.metric.__name__ || 'value';

        timeSeries.values.forEach(([timestamp, value]) => {
          if (!timeMap.has(timestamp)) {
            timeMap.set(timestamp, {
              key: timestamp,
              time: formatTime(timestamp, 'YYYY-MM-DD HH:mm:ss'),
              timestamp,
            });
          }
          timeMap.get(timestamp)![legend] = value;
        });
      });
    });

    // 转换为数组并按时间戳排序
    return Array.from(timeMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  });

  const paginationConfig = computed(() => {
    if (tableOptions.value.showPagination === false) {
      return false;
    }

    return {
      pageSize: tableOptions.value.pageSize || 20,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total: number) => `共 ${total} 条`,
      pageSizeOptions: ['10', '20', '50', '100'],
    };
  });
</script>

<style scoped lang="less">
  .table-chart {
    width: 100%;
    height: 100%;
    padding: 12px;
    overflow: hidden;

    :deep(.ant-table-wrapper) {
      height: 100%;
    }

    :deep(.ant-table) {
      font-size: 12px;
    }

    :deep(.ant-table-thead > tr > th) {
      background: #fafafa;
      font-weight: 600;
    }
  }
</style>
