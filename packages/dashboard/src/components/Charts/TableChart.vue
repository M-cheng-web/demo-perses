<!-- 表格 -->
<template>
  <div :class="bem()">
    <Spin v-if="isLoading" :class="bem('loading')" :spinning="true" />

    <div :class="bem('wrapper')">
      <Table :columns="columns" :data-source="dataSource" :pagination="paginationConfig" size="small">
        <template #bodyCell="{ column, text }">
          <template v-if="column.key !== 'time'">
            {{ formatValue(text, panel.options.format || {}) }}
          </template>
          <template v-else>
            {{ text }}
          </template>
        </template>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Spin, Table } from '@grafana-fast/component';
  import type { TableColumnType } from '@grafana-fast/component';
  import type { Panel, QueryResult, TableOptions } from '@grafana-fast/types';
  import { formatValue, formatTime, createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('table-chart');

  const props = defineProps<{
    panel: Panel;
    queryResults: QueryResult[];
  }>();

  const tableOptions = computed(() => (props.panel.options.specific as TableOptions) || {});

  // 判断是否正在加载
  const isLoading = computed(() => {
    return !props.queryResults || props.queryResults.length === 0;
  });

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
      hideOnSinglePage: true,
    };
  });
</script>

<style scoped lang="less">
  .dp-table-chart {
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
      width: 100%;
      height: 100%;
      min-height: 0;
      // padding: @spacing-sm-2;
      overflow: auto;

      :deep(.gf-table__wrap) {
        height: 100%;
      }

      :deep(.gf-table th),
      :deep(.gf-table td) {
        font-size: 12px;
      }

      :deep(.gf-table th) {
        background: #fafafa;
        font-weight: 600;
      }
    }
  }
</style>
