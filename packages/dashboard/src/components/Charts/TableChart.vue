<!-- 表格 -->
<template>
  <div :class="bem()">
    <Spin v-if="isLoading" :class="bem('loading')" :spinning="true" />

    <div ref="wrapperRef" :class="bem('wrapper')">
      <Table
        ref="tableRef"
        :columns="columns"
        :data-source="dataSource"
        :pagination="paginationConfig"
        :scroll="tableScroll"
        size="small"
        style="height: 100%"
      >
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
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  const wrapperRef = ref<HTMLElement | null>(null);
  const tableRef = ref<any>(null);
  const tableBodyHeight = ref(240);
  let resizeObserver: ResizeObserver | null = null;

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

  const tableScroll = computed(() => ({
    y: tableBodyHeight.value,
  }));

  const syncTableBodyHeight = async () => {
    await nextTick();
    const wrapperEl = wrapperRef.value;
    const tableEl = (tableRef.value?.$el ?? tableRef.value) as HTMLElement | undefined;
    if (!wrapperEl || !tableEl) return;

    const wrapperHeight = wrapperEl.clientHeight;
    if (wrapperHeight <= 0) return;

    const theadEl = tableEl.querySelector('.gf-table__thead') as HTMLElement | null;
    const paginationEl = tableEl.querySelector('.gf-table__pagination') as HTMLElement | null;
    const tableStyle = window.getComputedStyle(tableEl);

    const headerHeight = theadEl?.offsetHeight ?? 42;
    const paginationHeight = paginationEl?.offsetHeight ?? 0;
    const gap = Number.parseFloat(tableStyle.rowGap || tableStyle.gap || '0') || 0;
    const nextHeight = Math.max(96, Math.floor(wrapperHeight - headerHeight - paginationHeight - gap - 2));

    if (Math.abs(nextHeight - tableBodyHeight.value) > 1) {
      tableBodyHeight.value = nextHeight;
    }
  };

  onMounted(() => {
    void syncTableBodyHeight();

    if (wrapperRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        void syncTableBodyHeight();
      });
      resizeObserver.observe(wrapperRef.value);
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  watch(
    () => [columns.value.length, dataSource.value.length, paginationConfig.value === false ? 'off' : (paginationConfig.value.pageSize ?? 20)],
    () => {
      void syncTableBodyHeight();
    },
    { flush: 'post' }
  );
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
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-sm);
      padding: 16px;
      box-shadow: var(--gf-shadow-1);
    }

    &__wrapper {
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);

      :deep(.gf-table) {
        height: 100%;
      }
    }
  }
</style>
