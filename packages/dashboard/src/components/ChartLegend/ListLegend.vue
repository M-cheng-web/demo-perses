<!-- 列表模式图例 - 未使用 -->
<template>
  <div class="list-legend">
    <div class="legend-items">
      <!-- 全局选择多选框 -->
      <div class="legend-item global-selector" @click="handleGlobalToggle">
        <Checkbox
          :checked="globalSelectionState === 'all'"
          :indeterminate="globalSelectionState === 'indeterminate'"
          @click.stop="handleGlobalToggle"
        >
          全部
        </Checkbox>
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
  import { createNamespace } from '/#/utils';
  import type { LegendItem, LegendSelection } from '@grafana-fast/types/legend';
  import { Checkbox } from '@grafana-fast/component';

  const [_, _bem] = createNamespace('list-legend');

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
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;

    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: var(--gf-radius-sm);
        cursor: pointer;
        transition: all var(--gf-motion-fast) var(--gf-easing);
        user-select: none;
        font-size: 12px;
        line-height: 1.5714285714285714;

        &:hover {
          background-color: var(--gf-color-fill);
        }

        &.is-selected {
          background-color: var(--gf-color-primary-soft);
          border: 1px solid var(--gf-color-primary-border);
          margin: -1px;
        }

        &.is-dimmed {
          opacity: 0.3;
          transition: opacity var(--gf-motion-fast) var(--gf-easing);

          &:hover {
            opacity: 0.6;
          }
        }

        &.global-selector {
          font-weight: 500;
          background-color: var(--gf-color-surface-muted);
          border-bottom: 1px solid var(--gf-color-border-muted);
          margin-bottom: 4px;
          padding: 6px 8px;
          --gf-checkbox-font-size: 12px;
          border-radius: var(--gf-radius-sm) var(--gf-radius-sm) 0 0;

          &:hover {
            background-color: var(--gf-color-fill);
          }
        }

        .item-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
        }

        .item-label {
          font-size: 12px;
          line-height: 1.5714285714285714;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--gf-color-text);

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
      background: transparent;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--gf-color-fill-tertiary);
      border-radius: 3px;

      &:hover {
        background: var(--gf-color-fill-secondary);
      }
    }
  }
</style>
