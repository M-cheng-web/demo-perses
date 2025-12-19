<template>
  <div
    v-if="options.show !== false && items.length > 0"
    class="chart-legend"
    :class="[`legend-${options.position || 'bottom'}`, `legend-${options.size || 'medium'}`, `legend-mode-${effectiveMode}`]"
  >
    <component
      :is="legendComponent"
      :items="items"
      :selection="selection"
      :wrap-labels="wrapLabels"
      :display-columns="displayColumns"
      :global-selection-state="globalSelectionState"
      @item-click="handleItemClick"
      @item-hover="handleItemHover"
      @item-leave="handleItemLeave"
      @toggle-global-selection="handleToggleGlobalSelection"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendOptions, LegendSelection } from '@/types/legend';
  import CompactLegend from './CompactLegend.vue';
  import TableLegend from './TableLegend.vue';

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    options: LegendOptions;
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

  // 计算有效的图例模式
  const effectiveMode = computed(() => {
    const mode = props.options.mode || 'list';
    return mode;
  });

  // 表格模式下显示的列
  const displayColumns = computed(() => {
    if (effectiveMode.value === 'table' && props.options.values) {
      return props.options.values;
    }
    return [];
  });

  // 根据配置选择 Legend 组件
  const legendComponent = computed(() => {
    return effectiveMode.value === 'table' ? TableLegend : CompactLegend;
  });

  const handleItemClick = (id: string, isModified: boolean) => {
    emit('item-click', id, isModified);
  };

  const handleItemHover = (id: string) => {
    emit('item-hover', id);
  };

  const handleItemLeave = (id: string) => {
    emit('item-leave', id);
  };

  const handleToggleGlobalSelection = () => {
    emit('toggle-global-selection');
  };
</script>

<style scoped lang="less">
  .chart-legend {
    background-color: @background-base;
    transition: all 0.2s ease;
    margin-top: @spacing-sm;

    &.legend-bottom {
      width: 100%;
    }

    &.legend-right {
      height: 100%;
      border-top: none;
      border-left: 1px solid @border-color;
    }

    &.legend-top {
      width: 100%;
      border-top: none;
      border-bottom: 1px solid @border-color;
    }

    &.legend-left {
      height: 100%;
      border-top: none;
      border-right: 1px solid @border-color;
    }

    &.legend-small {
      font-size: 11px;
    }

    &.legend-medium {
      font-size: 12px;
    }

    &.legend-large {
      font-size: 14px;
    }

    // 不同模式的样式
    &.legend-mode-compact {
      // padding: @spacing-xs @spacing-sm;
    }

    &.legend-mode-list {
      // padding: @spacing-sm;
    }
  }
</style>
