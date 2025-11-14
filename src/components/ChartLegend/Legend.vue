<template>
  <div
    v-if="options.show !== false && items.length > 0"
    class="chart-legend"
    :class="[`legend-${options.position || 'bottom'}`, `legend-${options.size || 'medium'}`]"
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

// 根据配置选择 Legend 组件
const legendComponent = computed(() => {
  const mode = props.options.mode || 'compact';
  
  // 如果系列很多（>50），使用列表模式以支持滚动
  if (props.items.length > 50 && mode === 'compact') {
    return ListLegend;
  }
  
  return mode === 'list' ? ListLegend : CompactLegend;
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

  &.legend-bottom {
    width: 100%;
  }

  &.legend-right {
    height: 100%;
    border-top: none;
    border-left: 1px solid @border-color;
  }

  &.legend-small {
    font-size: 11px;
  }

  &.legend-medium {
    font-size: 12px;
  }
}
</style>

