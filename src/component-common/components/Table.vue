<template>
  <div :class="['ant-table-wrapper', bem()]">
    <div v-if="loading" class="cc-table__loading">
      <Spin />
    </div>
    <div class="cc-table__container" :style="bodyStyle">
      <table class="cc-table ant-table">
        <thead class="ant-table-thead">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key || col.dataIndex"
              :style="{ width: col.width ? addUnit(col.width) : undefined, textAlign: col.align || 'left' }"
              @click="() => handleSort(col)"
            >
              <span>{{ col.title }}</span>
              <span v-if="col.sorter" class="cc-table__sort">
                <span :class="{ 'is-active': sortState?.key === col.key && sortState?.order === 'ascend' }">▲</span>
                <span :class="{ 'is-active': sortState?.key === col.key && sortState?.order === 'descend' }">▼</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="ant-table-tbody">
          <tr v-for="record in pageData" :key="getRowKey(record)">
            <td v-for="col in columns" :key="col.key || col.dataIndex" :style="{ textAlign: col.align || 'left' }">
              <slot name="bodyCell" :column="col" :text="getCellValue(record, col)" :record="record">
                {{ getCellValue(record, col) }}
              </slot>
            </td>
          </tr>
          <tr v-if="!pageData.length">
            <td :colspan="columns.length" class="cc-table__empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="pagination !== false" class="cc-pagination">
      <span>{{ paginationText }}</span>
      <Button size="small" :disabled="pageState.current <= 1" @click="changePage(pageState.current - 1)">上一页</Button>
      <Button
        size="small"
        :disabled="pageState.current >= totalPages"
        @click="changePage(pageState.current + 1)"
      >
        下一页
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';
  import type { TableColumnType, TablePaginationConfig, TableProps } from '../types';
  import Button from './Button.vue';
  import Spin from './Spin.vue';

  const props = defineProps<
    TableProps & {
      columns: TableColumnType[];
      dataSource?: any[];
      loading?: boolean;
    }
  >();

  const [_, bem] = createNamespace('table');
  const sortState = ref<{ key?: string; order?: 'ascend' | 'descend'; sorter?: any }>();
  const columns = computed(() => props.columns || []);
  const dataSource = computed(() => props.dataSource || []);
  const pagination = computed(() => props.pagination);

  const pageState = reactive<TablePaginationConfig>({
    current: props.pagination && props.pagination !== false ? props.pagination.current || 1 : 1,
    pageSize: props.pagination && props.pagination !== false ? props.pagination.pageSize || 10 : Number.MAX_SAFE_INTEGER,
  });

  watch(
    () => props.pagination,
    (val) => {
      if (val && val !== false) {
        pageState.current = val.current || 1;
        pageState.pageSize = val.pageSize || 10;
      }
    },
    { deep: true }
  );

  const addUnit = (val: number | string) => (typeof val === 'number' ? `${val}px` : val);

  const sortedData = computed(() => {
    const data = [...dataSource.value];
    if (sortState.value?.sorter) {
      const sorter = sortState.value.sorter;
      const order = sortState.value.order;
      data.sort((a, b) => {
        const result = typeof sorter === 'function' ? sorter(a, b) : 0;
        return order === 'descend' ? -result : result;
      });
    }
    return data;
  });

  const totalPages = computed(() => Math.max(1, Math.ceil(sortedData.value.length / (pageState.pageSize || 10))));

  const pageData = computed(() => {
    if (props.pagination === false) return sortedData.value;
    const start = ((pageState.current || 1) - 1) * (pageState.pageSize || 10);
    return sortedData.value.slice(start, start + (pageState.pageSize || 10));
  });

  const paginationText = computed(() => {
    if (props.pagination === false) return '';
    const total = sortedData.value.length;
    return props.pagination?.showTotal ? props.pagination.showTotal(total) : `共 ${total} 条`;
  });

  const handleSort = (col: TableColumnType) => {
    if (!col.sorter) return;
    if (sortState.value?.key === col.key) {
      sortState.value.order = sortState.value.order === 'ascend' ? 'descend' : sortState.value.order === 'descend' ? undefined : 'ascend';
    } else {
      sortState.value = { key: col.key, order: 'ascend', sorter: col.sorter };
    }
    props.onChange?.({
      ...props.pagination,
      current: pageState.current,
      pageSize: pageState.pageSize,
      total: sortedData.value.length,
    });
  };

  const getCellValue = (record: any, col: TableColumnType) => {
    return col.dataIndex ? (record as any)[col.dataIndex] : '';
  };

  const getRowKey = (record: any) => {
    if (typeof props.rowKey === 'function') return props.rowKey(record);
    if (typeof props.rowKey === 'string') return record[props.rowKey];
    return record.key ?? JSON.stringify(record);
  };

  const changePage = (next: number) => {
    pageState.current = Math.min(Math.max(next, 1), totalPages.value);
    props.onChange?.({
      ...props.pagination,
      current: pageState.current,
      pageSize: pageState.pageSize,
      total: sortedData.value.length,
    });
  };

  const bodyStyle = computed(() => ({
    maxHeight: props.scroll?.y ? addUnit(props.scroll.y) : undefined,
    overflow: props.scroll?.y ? 'auto' : undefined,
  }));
</script>

<style scoped lang="less">
  .dp-table {
    position: relative;

    &__container {
      width: 100%;
      overflow: auto;
    }

    &__loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.6);
      z-index: 2;
    }

    &__sort {
      margin-left: 6px;
      font-size: 10px;
      color: var(--cc-text-secondary);

      .is-active {
        color: var(--cc-primary-strong);
      }
    }

    &__empty {
      text-align: center;
      color: var(--cc-text-secondary);
      padding: 12px 0;
    }
  }
</style>
