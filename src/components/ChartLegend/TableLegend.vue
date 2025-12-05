<!-- 表格模式图例 -->
<template>
  <div class="table-legend">
    <div class="legend-table-wrapper">
      <table class="legend-table">
        <thead>
          <tr>
            <th class="col-checkbox">
              <a-checkbox
                :checked="globalSelectionState === 'all'"
                :indeterminate="globalSelectionState === 'indeterminate'"
                @click.stop="handleGlobalToggle"
              />
            </th>
            <th class="col-series">系列</th>
            <th v-for="column in displayColumns" :key="column" class="col-value">
              {{ getColumnLabel(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="legend-row"
            :class="{
              'is-selected': isSelected(item.id),
              'is-dimmed': !isSelected(item.id) && hasSelection,
            }"
            @click="handleClick($event, item.id)"
            @mouseenter="emit('item-hover', item.id)"
            @mouseleave="emit('item-leave', item.id)"
          >
            <td class="col-checkbox">
              <a-checkbox :checked="isSelected(item.id)" @click.stop />
            </td>
            <td class="col-series">
              <span class="item-color" :style="{ backgroundColor: item.color }"></span>
              <span class="item-label" :title="item.label">{{ item.label }}</span>
            </td>
            <td v-for="column in displayColumns" :key="column" class="col-value">
              {{ getColumnValue(item, column) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendSelection } from '@/types/legend';

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

  const hasSelection = computed(() => props.selection !== 'ALL');

  const isSelected = (id: string) => {
    if (props.selection === 'ALL') return true;
    return !!props.selection[id];
  };

  const handleClick = (event: MouseEvent, id: string) => {
    const isModified = event.metaKey || event.ctrlKey || event.shiftKey;
    emit('item-click', id, isModified);
  };

  const handleGlobalToggle = () => {
    emit('toggle-global-selection');
  };

  // 获取列标签
  const getColumnLabel = (column: string): string => {
    const labelMap: Record<string, string> = {
      min: '最小值',
      max: '最大值',
      mean: '平均值',
      last: '最新值',
      first: '首值',
    };
    return labelMap[column] || column;
  };

  // 获取列值（使用假数据）
  const getColumnValue = (item: LegendItem, column: string): string => {
    // 这里使用假数据，实际应该从 item 的数据中获取
    const randomValue = () => (Math.random() * 100).toFixed(2);

    switch (column) {
      case 'min':
        return randomValue();
      case 'max':
        return randomValue();
      case 'mean':
        return randomValue();
      case 'last':
        return randomValue();
      case 'first':
        return randomValue();
      default:
        return '-';
    }
  };
</script>

<style scoped lang="less">
  .table-legend {
    max-height: 300px;
    overflow-y: auto;

    .legend-table-wrapper {
      width: 100%;
    }

    .legend-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;

      thead {
        position: sticky;
        top: 0;
        background: @background-base;
        z-index: 1;

        th {
          padding: 6px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          color: @text-color-secondary;
          border-bottom: 1px solid @border-color;
          white-space: nowrap;

          &.col-checkbox {
            width: 32px;
            text-align: center;
          }

          &.col-series {
            min-width: 150px;
          }

          &.col-value {
            width: 80px;
            text-align: right;
          }
        }
      }

      tbody {
        tr.legend-row {
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

          td {
            padding: 6px 8px;
            border-bottom: 1px solid fade(@border-color, 50%);

            &.col-checkbox {
              text-align: center;
            }

            &.col-series {
              display: flex;
              align-items: center;
              gap: 6px;

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

            &.col-value {
              text-align: right;
              font-variant-numeric: tabular-nums;
              color: @text-color-secondary;
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
