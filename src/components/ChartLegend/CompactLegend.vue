<!-- 紧凑模式图例 -->
<template>
  <div class="compact-legend">
    <div class="legend-items">
      <!-- 全局选择多选框 -->
      <div class="legend-item global-selector">
        <Checkbox
          :checked="globalSelectionState === 'all'"
          :indeterminate="globalSelectionState === 'indeterminate'"
          @click.stop="handleGlobalToggle"
        />
      </div>

      <!-- 各个 Legend 项 -->
      <div
        v-for="item in items"
        :key="item.id"
        class="legend-item"
        :class="{
          'is-selected': isSelected(item.id),
          'is-dimmed': !isSelected(item.id) && hasSelection,
        }"
        @click="handleClick($event, item.id)"
        @mouseenter="emit('item-hover', item.id)"
        @mouseleave="emit('item-leave', item.id)"
      >
        <span class="item-color" :style="{ backgroundColor: item.color }"></span>
        <span class="item-label" :class="{ wrap: wrapLabels }">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendSelection } from '@/types/legend';
  import { Checkbox } from 'ant-design-vue';

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    wrapLabels?: boolean;
    displayColumns?: string[]; // 表格模式专用，列表模式不使用
    globalSelectionState: 'all' | 'none' | 'indeterminate';
  }

  const props = withDefaults(defineProps<Props>(), {
    wrapLabels: false,
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
</script>

<style scoped lang="less">
  .compact-legend {
    max-height: 120px;
    overflow-y: auto;
    padding: 4px 0;

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        background-color: fade(@background-light, 50%);
        border: 1px solid transparent;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.12s ease;
        user-select: none;
        max-width: 280px;
        font-size: 11px;

        &:hover {
          background-color: fade(@primary-color, 8%);
          border-color: fade(@primary-color, 25%);
        }

        &.is-selected {
          background-color: fade(@primary-color, 10%);
          border-color: fade(@primary-color, 35%);
        }

        &.is-dimmed {
          opacity: 0.25;

          &:hover {
            opacity: 0.5;
          }
        }

        &.global-selector {
          font-weight: 500;
          background-color: transparent;
          border: 1px solid @border-color;
          margin-right: 2px;
          padding: 2px 6px;

          &:hover {
            background-color: fade(@primary-color, 5%);
            border-color: @primary-color;
          }

          :deep(.ant-checkbox-wrapper) {
            font-size: 11px;
          }
        }

        .item-color {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
        }

        .item-label {
          font-size: 11px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          &.wrap {
            white-space: normal;
            word-break: break-all;
          }
        }
      }
    }

    /* 滚动条样式 */
    &::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: fade(@border-color, 60%);
      border-radius: 3px;

      &:hover {
        background: @border-color;
      }
    }
  }
</style>
