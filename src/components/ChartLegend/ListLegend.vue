<!-- 列表模式图例 -->
<template>
  <div class="list-legend">
    <div class="legend-items">
      <!-- 全局选择多选框 -->
      <div class="legend-item global-selector" @click="handleGlobalToggle">
        <a-checkbox
          :checked="globalSelectionState === 'all'"
          :indeterminate="globalSelectionState === 'indeterminate'"
          @click.stop="handleGlobalToggle"
        >
          全部
        </a-checkbox>
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
        <span class="item-label" :class="{ wrap: wrapLabels }" :title="item.label">
          {{ item.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendSelection } from '@/types/legend';

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    wrapLabels?: boolean;
    globalSelectionState: 'all' | 'none' | 'indeterminate';
  }

  const props = withDefaults(defineProps<Props>(), {
    wrapLabels: false,
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
  .list-legend {
    padding: 6px;
    max-height: 200px;
    overflow-y: auto;

    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 1px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        font-size: 11px;

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

        &.global-selector {
          font-weight: 500;
          background-color: @background-light;
          border-bottom: 1px solid @border-color;
          margin-bottom: 2px;
          padding: 5px 6px;

          &:hover {
            background-color: fade(@primary-color, 6%);
          }

          :deep(.ant-checkbox-wrapper) {
            font-size: 12px;
          }
        }

        .item-color {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
        }

        .item-label {
          font-size: 11px;
          flex: 1;
          min-width: 0;
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
