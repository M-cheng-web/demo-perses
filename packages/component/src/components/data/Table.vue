<!-- 组件说明：轻量表格，支持排序、分页、加载遮罩与自定义单元格 -->
<template>
  <div :class="[bem(), bem(`size-${size}`)]">
    <div v-if="loading" :class="bem('overlay')">
      <Spin />
    </div>
    <div :class="bem('wrap')" :style="wrapStyle">
      <table>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key || col.dataIndex"
              :style="{ width: col.width ? `${col.width}px` : undefined }"
              @click="handleSort(col)"
            >
              <span>{{ col.title }}</span>
              <span v-if="col.sorter" :class="bem('sort')">
                <span :class="{ active: sortState?.key === (col.key || col.dataIndex) && sortState?.order === 'ascend' }">▲</span>
                <span :class="{ active: sortState?.key === (col.key || col.dataIndex) && sortState?.order === 'descend' }">▼</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in pagedData" :key="resolveRowKey(row, rowIndex)">
            <td v-for="col in columns" :key="col.key || col.dataIndex">
              <slot name="bodyCell" :column="col" :text="row[col.dataIndex || '']" :record="row" :index="rowIndex">
                {{ row[col.dataIndex || ''] }}
              </slot>
            </td>
          </tr>
          <tr v-if="!pagedData.length">
            <td :colspan="columns.length" :class="bem('empty')">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="pagination && !(pagination.hideOnSinglePage && pageCount <= 1)" :class="bem('pagination')">
      <span class="total" v-if="pagination.showTotal">{{ pagination.showTotal(filteredData.length) }}</span>
      <div :class="bem('pager')">
        <button type="button" @click="prevPage" :disabled="page === 1">上一页</button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button type="button" @click="nextPage" :disabled="page === pageCount">下一页</button>
      </div>
      <select v-if="pagination.showSizeChanger" v-model.number="pageSize">
        <option v-for="opt in pagination.pageSizeOptions || ['10', '20', '50', '100']" :key="opt" :value="Number(opt)">{{ opt }}/页</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import Spin from '../feedback/Spin.vue';

  interface Column {
    title: string;
    dataIndex?: string;
    key?: string;
    width?: number;
    sorter?: (a: any, b: any) => number;
  }

  interface PaginationConfig {
    pageSize?: number;
    current?: number;
    total?: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
    showTotal?: (total: number) => string;
    pageSizeOptions?: string[];
    hideOnSinglePage?: boolean;
  }

  defineOptions({ name: 'GfTable' });

  const props = withDefaults(
    defineProps<{
      /** 列配置 */
      columns: Column[];
      /** 数据源 */
      dataSource: any[];
      /** 分页配置，false 关闭 */
      pagination?: PaginationConfig | false;
      /** 表格尺寸 */
      size?: 'small' | 'middle';
      /** 是否展示加载 */
      loading?: boolean;
      /** 自定义行 key 生成 */
      rowKey?: (record: any) => string | number;
      /** 滚动配置 */
      scroll?: { y?: string | number };
    }>(),
    {
      columns: () => [],
      dataSource: () => [],
      pagination: () => ({
        pageSize: 20,
        showSizeChanger: true,
        showQuickJumper: true,
        hideOnSinglePage: true,
      }),
      size: 'middle',
      loading: false,
      rowKey: undefined,
      scroll: undefined,
    }
  );

  const [_, bem] = createNamespace('table');
  const emit = defineEmits<{
    (e: 'change', pagination: PaginationConfig): void;
  }>();

  const page = ref(props.pagination && (props.pagination as PaginationConfig).current ? (props.pagination as PaginationConfig).current! : 1);
  const pageSize = ref(props.pagination && props.pagination.pageSize ? props.pagination.pageSize : 20);
  const sortState = ref<{ key: string; order: 'ascend' | 'descend' } | null>(null);

  watch(
    () => props.dataSource,
    () => {
      page.value = 1;
    }
  );

  watch(pageSize, () => {
    page.value = 1;
    emitChange();
  });

  const sortedData = computed(() => {
    if (!sortState.value) return props.dataSource;
    const { key, order } = sortState.value;
    const col = props.columns.find((c) => c.key === key || c.dataIndex === key);
    if (!col || !col.sorter) return props.dataSource;
    const sorted = [...props.dataSource].sort(col.sorter);
    return order === 'ascend' ? sorted : sorted.reverse();
  });

  const filteredData = computed(() => sortedData.value);

  const pageCount = computed(() => {
    if (!props.pagination) return 1;
    return Math.max(1, Math.ceil(filteredData.value.length / pageSize.value));
  });

  const pagedData = computed(() => {
    if (!props.pagination) return filteredData.value;
    if (props.pagination.hideOnSinglePage && pageCount.value <= 1) return filteredData.value;
    const start = (page.value - 1) * pageSize.value;
    return filteredData.value.slice(start, start + pageSize.value);
  });

  const handleSort = (col: Column) => {
    if (!col.sorter) return;
    const key = col.key || col.dataIndex || '';
    if (!key) return;
    if (sortState.value?.key === key) {
      sortState.value = sortState.value.order === 'ascend' ? { key, order: 'descend' } : null;
    } else {
      sortState.value = { key, order: 'ascend' };
    }
    emitChange();
  };

  const prevPage = () => {
    page.value = Math.max(1, page.value - 1);
    emitChange();
  };

  const nextPage = () => {
    page.value = Math.min(pageCount.value, page.value + 1);
    emitChange();
  };

  const emitChange = () => {
    if (props.pagination) {
      emit('change', { ...props.pagination, pageSize: pageSize.value, current: page.value, total: filteredData.value.length });
    }
  };

  const resolveRowKey = (row: any, index: number) => {
    if (props.rowKey) return props.rowKey(row);
    return row.key ?? index;
  };

  const wrapStyle = computed(() => {
    if (props.scroll?.y) {
      const y = props.scroll.y;
      const height = typeof y === 'number' ? `${y}px` : y;
      return { maxHeight: height };
    }
    return {};
  });
</script>

<style scoped lang="less">
  .gf-table {
    display: flex;
    flex-direction: column;
    gap: var(--gf-space-3);
    width: 100%;
    position: relative;

    &__wrap {
      width: 100%;
      overflow: auto;
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface);
      position: relative;
      transition: border-color var(--gf-motion-normal) var(--gf-easing), box-shadow var(--gf-motion-normal) var(--gf-easing);
    }

    &__wrap:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 400px;
    }

    tbody tr:nth-child(even) td {
      background: var(--gf-color-zebra);
    }

    th,
    td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid var(--gf-color-border-muted);
      font-size: var(--gf-font-size-md);
      color: var(--gf-text);
    }

    th {
      background: var(--gf-color-surface-muted);
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      transition: background var(--gf-motion-normal) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill);
      }
    }

    tbody tr:hover td {
      background: var(--gf-color-fill);
    }

    &__sort {
      margin-left: 6px;
      font-size: 11px;
      color: var(--gf-text-secondary);

      .active {
        color: var(--gf-primary-strong);
      }
    }

    &__empty {
      text-align: center;
      color: var(--gf-text-secondary);
      padding: 18px;
    }

    &__pagination {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: flex-end;
      font-size: 12px;
      color: var(--gf-text-secondary);

      .total {
        margin-right: auto;
      }
    }

    &__pager {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      button {
        border: 1px solid var(--gf-color-border);
        background: var(--gf-color-surface);
        padding: 6px 10px;
        border-radius: var(--gf-radius-sm);
        cursor: pointer;
        color: var(--gf-text);
        transition: all 0.2s var(--gf-easing);

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    select {
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-sm);
      padding: 6px 10px;
      background: var(--gf-color-surface);
      color: var(--gf-text);
    }

    &--size-small th,
    &--size-small td {
      padding: 6px 8px;
      font-size: 12px;
    }

    &__overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--gf-color-overlay);
      z-index: 1;
      border-radius: var(--gf-radius-md);
    }
  }
</style>
