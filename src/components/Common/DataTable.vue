<!-- 可复用的数据表格组件 -->
<template>
  <div class="data-table">
    <div class="table-container">
      <!-- 表头 -->
      <div class="table-header">
        <div class="table-row">
          <!-- Checkbox 列 -->
          <div v-if="showCheckbox" class="table-cell col-checkbox">
            <Checkbox :checked="isAllChecked" :indeterminate="isIndeterminate" @click.stop="handleToggleAll" />
          </div>

          <!-- 其他列 -->
          <div
            v-for="column in columns"
            :key="column.key"
            class="table-cell"
            :class="[`col-${column.key}`, { sortable: column.sortable }]"
            :style="{ width: column.width || 'auto', minWidth: column.minWidth || 'auto' }"
            @click="column.sortable ? handleSort(column.key) : null"
          >
            <span class="cell-content">
              {{ column.label }}
            </span>
            <span v-if="column.sortable" class="sort-icon">
              <CaretUpOutlined v-if="sortBy === column.key && sortOrder === 'asc'" />
              <CaretDownOutlined v-else-if="sortBy === column.key && sortOrder === 'desc'" />
              <span v-else class="sort-default">⇅</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 表体 -->
      <div class="table-body">
        <div
          v-for="row in sortedData"
          :key="row.id"
          class="table-row"
          :class="{
            'is-selected': isRowSelected(row.id),
            'is-dimmed': isDimmed && !isRowSelected(row.id),
          }"
          @click="handleRowClick(row)"
          @mouseenter="emit('row-hover', row.id)"
          @mouseleave="emit('row-leave', row.id)"
        >
          <!-- Checkbox 列 -->
          <div v-if="showCheckbox" class="table-cell col-checkbox">
            <Checkbox :checked="isRowSelected(row.id)" @click.stop />
          </div>

          <!-- 其他列 -->
          <div
            v-for="column in columns"
            :key="column.key"
            class="table-cell"
            :class="`col-${column.key}`"
            :style="{ width: column.width || 'auto', minWidth: column.minWidth || 'auto' }"
          >
            <div class="cell-content" :class="{ ellipsis: column.ellipsis !== false }">
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

  // 排序状态
  const sortBy = ref<string | null>(null);
  const sortOrder = ref<'asc' | 'desc'>('asc');

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
    if (!sortBy.value) return props.data;

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

  // 排序处理
  const handleSort = (columnKey: string) => {
    if (sortBy.value === columnKey) {
      // 切换排序方向
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      // 新列，默认升序
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
  .data-table {
    width: 100%;
    font-size: 11px;
    max-height: 300px;
    overflow-y: auto;

    .table-container {
      width: 100%;
    }

    .table-header {
      position: sticky;
      top: 0;
      background: @background-base;
      z-index: 1;
      border-bottom: 1px solid @border-color;

      .table-row {
        display: flex;
        align-items: center;
        padding: 6px 8px;
      }

      .table-cell {
        font-size: 14px;
        font-weight: 600;
        color: @text-color-secondary;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 2px;

        &.sortable {
          cursor: pointer;
          user-select: none;

          &:hover {
            color: @primary-color;
          }
        }

        &.col-checkbox {
          width: 32px;
          flex-shrink: 0;
        }

        .cell-content {
          flex: 1;
          min-width: 0;

          border: 1px solid red;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sort-icon {
          font-size: 10px;
          color: @text-color-secondary;

          border: 1px solid red;

          .sort-default {
            opacity: 0.3;
            font-size: 12px;
          }
        }
      }
    }

    .table-body {
      .table-row {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        border-bottom: 1px solid fade(@border-color, 50%);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background-color: fade(@primary-color, 6%);
        }

        &.is-selected {
          background-color: fade(@primary-color, 10%);
        }

        &.is-dimmed {
          opacity: 0.3;

          &:hover {
            opacity: 0.6;
          }
        }

        .table-cell {
          color: @text-color;
          display: flex;
          align-items: center;

          &.col-checkbox {
            width: 32px;
            flex-shrink: 0;
          }

          .cell-content {
            width: 100%;
            min-width: 0;

            &.ellipsis {
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
      background: @background-light;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: @border-color;
      border-radius: 3px;

      &:hover {
        background: darken(@border-color, 10%);
      }
    }
  }
</style>
