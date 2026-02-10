<!-- 组件说明：轻量表格，支持排序、分页、加载遮罩与自定义单元格 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${resolvedSize}`]: true, bordered }),
      { 'has-scroll-y': hasScrollY, 'has-scroll-x': hasScrollX, 'use-body-scroll': useBodyScroll },
    ]"
  >
    <Spin :spinning="loading" :tip="loadingTip" :class="bem('spin')">
      <div :class="bem('container')">
        <div :class="bem('content')" :style="wrapStyle">
          <table :class="bem('table')" :style="tableStyle">
            <thead :class="bem('thead')">
              <tr>
                <th
                  v-for="col in columns"
                  :key="col.key || col.dataIndex"
                  :class="[bem('cell'), bem('cell-header'), { 'is-sortable': !!col.sorter }]"
                  :style="{ width: col.width ? `${col.width}px` : undefined }"
                  @click="handleSort(col)"
                >
                  <div :class="bem('cell-content')">
                    <span>{{ col.title }}</span>
                    <span v-if="col.sorter" :class="bem('sorter')">
                      <CaretUpOutlined :class="{ 'is-active': sortState?.key === (col.key || col.dataIndex) && sortState?.order === 'ascend' }" />
                      <CaretDownOutlined :class="{ 'is-active': sortState?.key === (col.key || col.dataIndex) && sortState?.order === 'descend' }" />
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody ref="tbodyRef" :class="bem('tbody')" :style="tbodyStyle">
              <tr v-for="(row, rowIndex) in pagedData" :key="resolveRowKey(row, rowIndex)" :class="bem('row')">
                <td
                  v-for="col in columns"
                  :key="col.key || col.dataIndex"
                  :class="bem('cell')"
                  :style="{ width: col.width ? `${col.width}px` : undefined }"
                >
                  <slot name="bodyCell" :column="col" :text="row[col.dataIndex || '']" :record="row" :index="rowIndex">
                    {{ row[col.dataIndex || ''] }}
                  </slot>
                </td>
              </tr>
              <tr v-if="!pagedData.length">
                <td :colspan="columns.length" :class="bem('empty')">
                  <Empty :description="emptyText" image="simple" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Spin>
    <div v-if="mergedPagination !== false && !(mergedPagination.hideOnSinglePage && pageCount <= 1)" :class="bem('pagination')">
      <Pagination
        :total="filteredData.length"
        :current="page"
        :page-size="pageSize"
        :show-size-changer="mergedPagination.showSizeChanger"
        :show-quick-jumper="mergedPagination.showQuickJumper"
        :show-total="mergedPagination.showTotal"
        :page-size-options="mergedPagination.pageSizeOptions"
        :size="resolvedSize === 'small' ? 'small' : 'default'"
        @update:current="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { useComponentSize } from '../../context/size';
  import Spin from '../feedback/Spin.vue';
  import Empty from '../base/Empty.vue';
  import Pagination from '../navigation/Pagination.vue';
  import { getColumnKey, nextSortState, type SortState } from './table/tableLogic';

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
      size?: 'small' | 'middle' | 'large';
      /** 是否展示加载 */
      loading?: boolean;
      /** 加载提示文字 */
      loadingTip?: string;
      /** 是否显示边框 */
      bordered?: boolean;
      /** 空状态文案 */
      emptyText?: string;
      /** 自定义行 key 生成 */
      rowKey?: (record: any) => string | number;
      /** 滚动配置 */
      scroll?: { y?: string | number; x?: string | number };
    }>(),
    {
      columns: () => [],
      dataSource: () => [],
      pagination: undefined,
      size: undefined,
      loading: false,
      loadingTip: '',
      bordered: false,
      emptyText: '暂无数据',
      rowKey: undefined,
      scroll: undefined,
    }
  );

  const [_, bem] = createNamespace('table');
  const resolvedSize = useComponentSize(computed(() => props.size));
  const emit = defineEmits<{
    (e: 'change', pagination: PaginationConfig): void;
  }>();

  const mergedPagination = computed<PaginationConfig | false>(() => {
    if (props.pagination === false) return false;
    const provided = props.pagination ?? {};
    return {
      pageSize: 20,
      showSizeChanger: true,
      showQuickJumper: false,
      hideOnSinglePage: true,
      pageSizeOptions: ['10', '20', '50', '100'],
      ...provided,
    };
  });

  const page = ref(mergedPagination.value !== false && mergedPagination.value.current ? mergedPagination.value.current : 1);
  const pageSize = ref(mergedPagination.value !== false && mergedPagination.value.pageSize ? mergedPagination.value.pageSize : 20);
  const sortState = ref<SortState | null>(null);
  const tbodyRef = ref<HTMLTableSectionElement | null>(null);

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
    if (mergedPagination.value === false) return 1;
    return Math.max(1, Math.ceil(filteredData.value.length / pageSize.value));
  });

  const pagedData = computed(() => {
    if (mergedPagination.value === false) return filteredData.value;
    if (mergedPagination.value.hideOnSinglePage && pageCount.value <= 1) return filteredData.value;
    const start = (page.value - 1) * pageSize.value;
    return filteredData.value.slice(start, start + pageSize.value);
  });

  const handleSort = (col: Column) => {
    if (!col.sorter) return;
    const key = getColumnKey(col);
    if (!key) return;
    sortState.value = nextSortState(sortState.value, key);
    emitChange();
  };

  const handlePageChange = (p: number) => {
    page.value = p;
    emitChange();
  };

  const handlePageSizeChange = (size: number) => {
    pageSize.value = size;
  };

  const emitChange = () => {
    if (mergedPagination.value !== false) {
      emit('change', { ...mergedPagination.value, pageSize: pageSize.value, current: page.value, total: filteredData.value.length });
    }
  };

  const resolveRowKey = (row: any, index: number) => {
    if (props.rowKey) return props.rowKey(row);
    return row.key ?? index;
  };

  const hasScrollY = computed(() => props.scroll?.y !== undefined && props.scroll?.y !== null && props.scroll?.y !== '');
  const hasScrollX = computed(() => props.scroll?.x !== undefined && props.scroll?.x !== null && props.scroll?.x !== '');
  const useBodyScroll = computed(() => hasScrollY.value && !hasScrollX.value);

  const tableStyle = computed<Record<string, string> | undefined>(() => {
    if (!hasScrollX.value) {
      return {
        width: '100%',
        minWidth: '100%',
      };
    }
    const x = props.scroll?.x;
    if (!x) return undefined;
    return {
      width: 'max-content',
      minWidth: typeof x === 'number' ? `${x}px` : x,
    };
  });

  const wrapStyle = computed(() => {
    const style: Record<string, string> = {};
    style.overflowX = 'auto';
    if (hasScrollY.value && !useBodyScroll.value) {
      const y = props.scroll?.y;
      if (!y) return style;
      style.maxHeight = typeof y === 'number' ? `${y}px` : y;
      style.overflowY = 'auto';
    } else {
      style.overflowY = 'visible';
    }
    return style;
  });

  const tbodyStyle = computed<Record<string, string> | undefined>(() => {
    if (!useBodyScroll.value) return undefined;
    const y = props.scroll?.y;
    if (!y) return undefined;
    return {
      maxHeight: typeof y === 'number' ? `${y}px` : y,
    };
  });

  watch([page, pageSize], () => {
    if (!useBodyScroll.value) return;
    const el = tbodyRef.value;
    if (!el) return;
    el.scrollTop = 0;
  });
</script>

<style scoped lang="less">
  .gf-table {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;

    &__container {
      width: 100%;
      min-width: 0;
      overflow: hidden;
    }

    &__spin {
      width: 100%;
      min-width: 0;
    }

    &__spin :deep(.gf-spin__container) {
      width: 100%;
      min-width: 0;
    }

    &__content {
      width: 100%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
    }

    &__table {
      width: 100%;
      min-width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: auto;
    }

    &:not(.has-scroll-x) &__table {
      table-layout: fixed;
    }

    &__thead {
      background: var(--gf-color-fill);
    }

    &__tbody {
      background: var(--gf-color-surface);
    }

    &__cell {
      padding: 16px;
      text-align: left;
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      color: var(--gf-color-text);
      border-bottom: 1px solid var(--gf-color-border);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__cell-header {
      font-weight: 600;
      color: var(--gf-color-text);
      background: var(--gf-color-fill);
      position: relative;
      padding-top: 12px;
      padding-bottom: 12px;

      &.is-sortable {
        cursor: pointer;
        user-select: none;

        &:hover {
          background: var(--gf-color-fill-secondary);
        }
      }
    }

    &__cell-content {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    &__sorter {
      display: inline-flex;
      flex-direction: column;
      gap: 1px;
      margin-left: 1px;
      font-size: 9px;
      line-height: 1;
      color: var(--gf-color-text-tertiary);

      > * {
        display: block;
        line-height: 1;
      }

      .is-active {
        color: var(--gf-color-primary);
      }
    }

    &__row {
      transition: background var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill);
      }
    }

    &__empty {
      padding: 32px 16px;
      text-align: center;
    }

    &__pagination {
      display: flex;
      justify-content: flex-end;
    }

    &.has-scroll-y &__cell-header {
      position: sticky;
      top: 0;
      z-index: 4;
      background: var(--gf-color-fill);
      background-clip: padding-box;
    }

    &.has-scroll-y &__thead {
      position: relative;
      z-index: 3;
    }

    &.has-scroll-y &__cell-header::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 1px;
      background: var(--gf-color-border);
      pointer-events: none;
    }

    &.use-body-scroll &__content {
      overflow-y: visible;
    }

    &.use-body-scroll &__table {
      table-layout: fixed;
    }

    &.use-body-scroll &__thead > tr,
    &.use-body-scroll &__tbody > tr {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    &.use-body-scroll &__thead {
      display: block;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }

    &.use-body-scroll &__tbody {
      display: block;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }

    &.use-body-scroll &__cell-header {
      position: relative;
      top: auto;
      z-index: 1;
    }

    // Bordered variant
    &--bordered &__table {
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-lg);
      overflow: hidden;
    }

    &--bordered &__cell {
      border-right: 1px solid var(--gf-color-border);

      &:last-child {
        border-right: none;
      }
    }

    &--bordered &__thead &__cell:first-child {
      border-top-left-radius: var(--gf-radius-lg);
    }

    &--bordered &__thead &__cell:last-child {
      border-top-right-radius: var(--gf-radius-lg);
    }

    // Size variants
    &--size-small &__cell {
      padding: 8px 8px;
      font-size: var(--gf-font-size-xs);
    }

    &--size-small &__sorter {
      font-size: 8px;
      gap: 0;
    }

    &--size-large &__cell {
      padding: 20px 16px;
      font-size: var(--gf-font-size-md);
    }

    &--size-large &__sorter {
      font-size: 10px;
    }
  }
</style>
