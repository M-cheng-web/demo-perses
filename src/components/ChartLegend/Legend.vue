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
      @item-click="handleItemClick"
      @item-hover="handleItemHover"
      @item-leave="handleItemLeave"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { LegendItem, LegendOptions, LegendSelection } from '@/types/legend';
  import CompactLegend from './CompactLegend.vue';
  import ListLegend from './ListLegend.vue';

  interface Props {
    items: LegendItem[];
    selection: LegendSelection;
    options: LegendOptions;
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

  // 计算有效的图例模式
  const effectiveMode = computed(() => {
    const mode = props.options.mode || 'compact';

    // 如果系列很多（>50），自动切换到列表模式以支持滚动
    if (props.items.length > 50 && mode === 'compact') {
      return 'list';
    }

    return mode;
  });

  // 根据配置选择 Legend 组件
  const legendComponent = computed(() => {
    return effectiveMode.value === 'list' ? ListLegend : CompactLegend;
  });

  const handleItemClick = (id: string, isModified: boolean) => {
    emit('itemClick', id, isModified);
  };

  const handleItemHover = (id: string) => {
    emit('itemHover', id);
  };

  const handleItemLeave = (id: string) => {
    emit('itemLeave', id);
  };
</script>

<style scoped lang="less">
  .chart-legend {
    background-color: @background-base;
    border-top: 1px solid @border-color;
    transition: all 0.2s ease;

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
      padding: @spacing-xs @spacing-sm;
    }

    &.legend-mode-list {
      padding: @spacing-sm;
    }
  }
</style>
