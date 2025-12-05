<!-- 表格模式图例 -->
<template>
  <div class="table-legend">
    <DataTable
      :columns="tableColumns"
      :data="tableData"
      :selected-ids="selectedIds"
      :is-dimmed="hasSelection"
      @row-click="handleRowClick"
      @row-hover="(id) => emit('item-hover', id)"
      @row-leave="(id) => emit('item-leave', id)"
      @toggle-all="emit('toggle-global-selection')"
    >
      <!-- 系列列的自定义内容 -->
      <template #cell-series="{ row }">
        <div class="series-cell">
          <span class="item-color" :style="{ backgroundColor: row.color }"></span>
          <span class="item-label" :title="row.label">{{ row.label }}</span>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendSelection } from '@/types/legend';
  import DataTable from '@/components/Common/DataTable.vue';

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    displayColumns?: string[]; // 需要显示的列，如 ['min', 'max', 'mean', 'last', 'first']
    globalSelectionState: 'all' | 'none' | 'indeterminate';
  }

  const props = withDefaults(defineProps<Props>(), {
    displayColumns: () => [],
  });

  const emit = defineEmits<{
    (e: 'item-click', id: string, isModified: boolean): void;
    (e: 'item-hover', id: string): void;
    (e: 'item-leave', id: string): void;
    (e: 'toggle-global-selection'): void;
  }>();

  // 是否有选中状态
  const hasSelection = computed(() => props.selection !== 'ALL');

  // 选中的 ID 列表
  const selectedIds = computed(() => {
    if (props.selection === 'ALL') return 'ALL';
    return Object.keys(props.selection).filter((id: string) => props.selection[id as keyof LegendSelection]);
  });

  // 获取列标签
  const getColumnLabel = (column: string): string => {
    const labelMap: Record<string, string> = {
      min: '最小',
      max: '最大',
      mean: '平均',
      last: '最新',
      first: '首值',
    };
    return labelMap[column] || column;
  };

  // 获取列值（使用假数据）
  const getColumnValue = (): string => {
    const randomValue = () => (Math.random() * 100).toFixed(2);
    return randomValue();
  };

  // 表格列定义
  const tableColumns = computed(() => {
    const columns = [
      {
        key: 'series',
        label: '系列',
        width: '180px',
        minWidth: '120px',
        sortable: true,
        ellipsis: true,
      },
    ];

    // 添加动态列
    props.displayColumns.forEach((col) => {
      columns.push({
        key: col,
        label: getColumnLabel(col),
        width: '70px',
        minWidth: '60px',
        sortable: true,
        ellipsis: false,
      });
    });

    return columns;
  });

  // 表格数据
  const tableData = computed(() => {
    return props.items.map((item) => {
      const row: any = {
        id: item.id,
        series: item.label,
        label: item.label,
        color: item.color,
      };

      // 添加动态列的值
      props.displayColumns.forEach((col) => {
        row[col] = getColumnValue();
      });

      return row;
    });
  });

  // 行点击处理
  const handleRowClick = (row: any) => {
    emit('item-click', row.id, false);
  };
</script>

<style scoped lang="less">
  .table-legend {
    .series-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;

      .item-color {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
      }

      .item-label {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
      }
    }
  }
</style>
