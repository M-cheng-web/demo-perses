<template>
  <div class="compact-legend">
    <div class="legend-items">
      <div
        v-for="item in items"
        :key="item.id"
        class="legend-item"
        :class="{
          'is-selected': isSelected(item.id),
          'is-dimmed': !isSelected(item.id) && hasSelection,
        }"
        @click="handleClick($event, item.id)"
        @mouseenter="emit('itemHover', item.id)"
        @mouseleave="emit('itemLeave', item.id)"
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

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    wrapLabels?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    wrapLabels: false,
  });

  const emit = defineEmits<{
    (e: 'itemClick', id: string, isModified: boolean): void;
    (e: 'itemHover', id: string): void;
    (e: 'itemLeave', id: string): void;
  }>();

  const hasSelection = computed(() => props.selection !== 'ALL');

  const isSelected = (id: string) => {
    if (props.selection === 'ALL') return true;
    return !!props.selection[id];
  };

  const handleClick = (event: MouseEvent, id: string) => {
    const isModified = event.metaKey || event.ctrlKey || event.shiftKey;
    emit('itemClick', id, isModified);
  };
</script>

<style scoped lang="less">
  .compact-legend {
    padding: 10px 12px;
    max-height: 150px;
    overflow-y: auto;

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        background-color: @background-light;
        border: 1px solid @border-color;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        user-select: none;
        max-width: 300px;

        &:hover {
          border-color: @primary-color;
          background-color: fade(@primary-color, 10%);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        &.is-selected {
          border-color: @primary-color;
          background-color: fade(@primary-color, 15%);
          font-weight: 500;
          box-shadow: 0 0 0 1px fade(@primary-color, 20%);
        }

        &.is-dimmed {
          opacity: 0.35;

          &:hover {
            opacity: 0.7;
          }
        }

        .item-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
        }

        .item-label {
          font-size: 12px;
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
      height: 6px;
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
