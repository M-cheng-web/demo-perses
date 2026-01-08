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
              minWidth: column.minWidth || 'auto',
              flex: column.width ? '0 0 auto' : '1 1 0',
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
          :class="[
            bem('row'),
            bem('row', { selected: isRowSelected(row.id) }),
            bem('row', { dimmed: isDimmed && !isRowSelected(row.id) }),
          ]"
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
              minWidth: column.minWidth || 'auto',
              flex: column.width ? '0 0 auto' : '1 1 0',
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
  import { Checkbox } from 'ant-design-vue';
  import { createNamespace } from '@/utils';

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
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
    border-radius: 4px;

    &__container {
      width: 100%;
    }

    &__header {
      position: sticky;
      top: 0;
      background: @background-base;
      z-index: 1;
      border-bottom: 1px solid @border-color;

      .dp-data-table__row {
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 12px;
      }

      .dp-data-table__cell {
        font-size: 14px;
        font-weight: 500;
        color: @text-color;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
        position: relative;
        padding-right: 12px;

        &:not(.dp-data-table__cell--checkbox):not(:last-child)::after {
          content: '';
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          height: 70%;
          width: 1px;
          background-color: fade(@border-color, 60%);
        }

        &.dp-data-table__cell--sortable {
          cursor: pointer;
          user-select: none;
          transition: color 0.2s ease;

          &:hover {
            color: @primary-color;

            .dp-data-table__sort-icon {
              opacity: 1;
            }
          }
        }

        &.dp-data-table__cell--checkbox {
          width: 32px;
          flex-shrink: 0;
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
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        transition: opacity 0.2s ease;
        flex-shrink: 0;

        :deep(.anticon) {
          line-height: 0.8;
          display: block;
          transition: all 0.2s ease;

          &.active {
            color: @primary-color;
            opacity: 1;
          }

          &.inactive {
            color: @text-color-secondary;
            opacity: 0.3;
          }
        }
      }
    }

    &__body {
      .dp-data-table__row {
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 12px;
        border-bottom: 1px solid fade(@border-color, 30%);
        cursor: pointer;
        transition: all 0.2s ease;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: fade(@primary-color, 5%);
        }

        &.dp-data-table__row--selected {
          background-color: fade(@primary-color, 8%);

          &:hover {
            background-color: fade(@primary-color, 12%);
          }
        }

        &.dp-data-table__row--dimmed {
          opacity: 0.35;

          &:hover {
            opacity: 0.6;
          }
        }

        .dp-data-table__cell {
          color: @text-color;
          display: flex;
          align-items: center;
          padding-right: 12px;

          &.dp-data-table__cell--checkbox {
            width: 32px;
            flex-shrink: 0;
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
    }

    /* 滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: fade(@border-color, 60%);
      border-radius: 3px;

      &:hover {
        background: darken(@border-color, 10%);
      }
    }
  }
</style>
