<!-- 可复用的数据表格组件 -->
<template>
  <div :class="bem()">
    <div :class="bem('container')">
      <!-- 表头 -->
      <div :class="bem('header')">
        <div :class="bem('row')">
          <!-- Checkbox 列 -->
          <div v-if="showCheckbox" :class="[bem('cell'), bem('cell', { checkbox: true })]">
            <Checkbox :checked="isAllChecked" :indeterminate="isIndeterminate" @click.stop="handleToggleAll" />
          </div>

          <!-- 其他列 -->
          <div
            v-for="column in columns"
            :key="column.key"
            :class="[bem('cell'), bem('cell', { [`col-${column.key}`]: true }), bem('cell', { sortable: column.sortable })]"
            :style="{
              width: column.width || undefined,
              minWidth: column.minWidth || '60px',
              flex: column.width ? `0 0 ${column.width}` : '1 1 0%',
            }"
            @click="column.sortable ? handleSort(column.key) : null"
          >
            <span :class="bem('cell-content')">
              {{ column.label }}
            </span>
            <span v-if="column.sortable" :class="bem('sort-icon')" @click.stop="handleSort(column.key)">
              <CaretUpOutlined
                :class="{
                  active: sortBy === column.key && sortOrder === 'asc',
                  inactive: sortBy !== column.key || sortOrder !== 'asc',
                }"
              />
              <CaretDownOutlined
                :class="{
                  active: sortBy === column.key && sortOrder === 'desc',
                  inactive: sortBy !== column.key || sortOrder !== 'desc',
                }"
              />
            </span>
          </div>
        </div>
      </div>

      <!-- 表体 -->
      <div :class="bem('body')">
        <div
          v-for="row in sortedData"
          :key="row.id"
          :class="[bem('row'), bem('row', { selected: isRowSelected(row.id) }), bem('row', { dimmed: isDimmed && !isRowSelected(row.id) })]"
          @click="handleRowClick(row)"
          @mouseenter="emit('row-hover', row.id)"
          @mouseleave="emit('row-leave', row.id)"
        >
          <!-- Checkbox 列 -->
          <div v-if="showCheckbox" :class="[bem('cell'), bem('cell', { checkbox: true })]">
            <Checkbox :checked="isRowSelected(row.id)" />
          </div>

          <!-- 其他列 -->
          <div
            v-for="column in columns"
            :key="column.key"
            :class="[bem('cell'), bem('cell', { [`col-${column.key}`]: true })]"
            :style="{
              width: column.width || undefined,
              minWidth: column.minWidth || '60px',
              flex: column.width ? `0 0 ${column.width}` : '1 1 0%',
            }"
          >
            <div :class="[bem('cell-content'), bem('cell-content', { ellipsis: column.ellipsis !== false })]">
              <!-- 使用插槽，如果没有插槽则显示默认值 -->
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                {{ row[column.key] }}
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons-vue';
  import { Checkbox } from '@grafana-fast/component';
  import { createNamespace } from '/#/utils';

  const [_, bem] = createNamespace('data-table');

  interface Column {
    key: string;
    label: string;
    width?: string;
    minWidth?: string;
    sortable?: boolean;
    ellipsis?: boolean; // 默认为 true
  }

  interface Row {
    id: string;
    [key: string]: any;
  }

  interface Props {
    columns: Column[];
    data: Row[];
    showCheckbox?: boolean;
    selectedIds?: string[] | 'ALL';
    isDimmed?: boolean; // 是否有选中状态（用于显示未选中项的降低透明度效果）
  }

  const props = withDefaults(defineProps<Props>(), {
    showCheckbox: true,
    selectedIds: 'ALL',
    isDimmed: false,
  });

  const emit = defineEmits<{
    (e: 'row-click', row: Row): void;
    (e: 'row-hover', id: string): void;
    (e: 'row-leave', id: string): void;
    (e: 'toggle-all'): void;
  }>();

  // 排序状态 - 支持三态：null(默认) -> asc -> desc -> null
  const sortBy = ref<string | null>(null);
  const sortOrder = ref<'asc' | 'desc' | null>(null);

  // 全选状态
  const isAllChecked = computed(() => {
    if (props.selectedIds === 'ALL') return true;
    return props.selectedIds.length === props.data.length;
  });

  const isIndeterminate = computed(() => {
    if (props.selectedIds === 'ALL') return false;
    return props.selectedIds.length > 0 && props.selectedIds.length < props.data.length;
  });

  // 行选中状态
  const isRowSelected = (id: string): boolean => {
    if (props.selectedIds === 'ALL') return true;
    return props.selectedIds.includes(id);
  };

  // 排序后的数据
  const sortedData = computed(() => {
    if (!sortBy.value || !sortOrder.value) return props.data;

    return [...props.data].sort((a, b) => {
      const aValue = a[sortBy.value!];
      const bValue = b[sortBy.value!];

      // 处理数字类型
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 处理字符串类型
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      const comparison = aStr.localeCompare(bStr);
      return sortOrder.value === 'asc' ? comparison : -comparison;
    });
  });

  // 排序处理 - 三态切换：null -> asc -> desc -> null
  const handleSort = (columnKey: string) => {
    if (sortBy.value === columnKey) {
      // 同一列：切换排序状态
      if (sortOrder.value === null) {
        sortOrder.value = 'asc';
      } else if (sortOrder.value === 'asc') {
        sortOrder.value = 'desc';
      } else {
        // desc -> null，重置排序
        sortBy.value = null;
        sortOrder.value = null;
      }
    } else {
      // 新列，设置为升序
      sortBy.value = columnKey;
      sortOrder.value = 'asc';
    }
  };

  // 行点击处理
  const handleRowClick = (row: Row) => {
    emit('row-click', row);
  };

  // 全选切换
  const handleToggleAll = () => {
    emit('toggle-all');
  };
</script>

<style scoped lang="less">
  .dp-data-table {
    width: 100%;
    font-size: 13px;
    height: 100%;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    border-radius: var(--gf-radius-lg);
    border: 1px solid var(--gf-color-border-muted);
    overflow: hidden;

    &__container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    &__header {
      flex-shrink: 0;
      background: var(--gf-color-surface-muted);
      border-bottom: 1px solid var(--gf-color-border-muted);

      .dp-data-table__row {
        display: flex;
        align-items: center;
        height: 32px;
        padding: 0 8px;
      }

      .dp-data-table__cell {
        font-size: 12px;
        font-weight: 500;
        color: var(--gf-color-text);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 2px;
        position: relative;
        padding-right: 8px;
        line-height: 1.5714285714285714;

        &:not(.dp-data-table__cell--checkbox):not(:last-child)::after {
          content: '';
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          height: 50%;
          width: 1px;
          background-color: var(--gf-color-border-muted);
        }

        &.dp-data-table__cell--sortable {
          cursor: pointer;
          user-select: none;
          transition: color var(--gf-motion-fast) var(--gf-easing);

          &:hover {
            color: var(--gf-color-primary);

            .dp-data-table__sort-icon {
              opacity: 1;
            }
          }
        }

        &.dp-data-table__cell--checkbox {
          width: 28px;
          flex: 0 0 28px;
          padding-right: 0;
        }
      }

      .dp-data-table__cell-content {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dp-data-table__sort-icon {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: opacity var(--gf-motion-fast) var(--gf-easing);
        flex-shrink: 0;
        margin-left: 2px;
        gap: 0;

        :deep(.anticon) {
          font-size: 8px;
          line-height: 1;
          display: block;
          transition: all var(--gf-motion-fast) var(--gf-easing);
          margin: -1px 0;

          &.active {
            color: var(--gf-color-primary);
            opacity: 1;
          }

          &.inactive {
            color: var(--gf-color-text-tertiary);
            opacity: 0.35;
          }
        }
      }
    }

    &__body {
      flex: 1;
      overflow-y: auto;

      .dp-data-table__row:nth-child(even):not(.dp-data-table__row--selected) {
        background-color: var(--gf-color-fill-tertiary);
      }

      .dp-data-table__row {
        display: flex;
        align-items: center;
        height: 32px;
        padding: 0 8px;
        border-bottom: 1px solid var(--gf-color-border-muted);
        cursor: pointer;
        transition: all var(--gf-motion-fast) var(--gf-easing);

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: var(--gf-color-fill);
        }

        &.dp-data-table__row--selected {
          background-color: var(--gf-color-primary-soft);

          &:hover {
            background-color: var(--gf-color-primary-soft-hover);
          }
        }

        &.dp-data-table__row--dimmed {
          opacity: 0.35;
          transition: opacity var(--gf-motion-fast) var(--gf-easing);

          &:hover {
            opacity: 0.65;
          }
        }

        .dp-data-table__cell {
          color: var(--gf-color-text);
          display: flex;
          align-items: center;
          padding-right: 8px;

          &.dp-data-table__cell--checkbox {
            width: 28px;
            flex: 0 0 28px;
            padding-right: 0;
          }

          .dp-data-table__cell-content {
            width: 100%;
            min-width: 0;

            &.dp-data-table__cell-content--ellipsis {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
      }

      /* Body scrollbar styling */
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--gf-color-fill-secondary);
        border-radius: 3px;

        &:hover {
          background: var(--gf-color-fill);
        }
      }
    }
  }
</style>
