<!-- 组件说明：轻量虚拟列表（固定行高），用于大列表性能优化 -->
<template>
  <div ref="root" :class="bem()" :style="{ height: normalizedHeight }" @scroll="handleScroll">
    <div :class="bem('spacer')" :style="{ height: `${totalHeight}px` }"></div>
    <div :class="bem('viewport')" :style="{ transform: `translateY(${offsetY}px)` }">
      <div v-for="(item, i) in visibleItems" :key="resolveKey(item, startIndex + i)" :class="bem('row')" :style="{ height: `${itemHeight}px` }">
        <slot :item="item" :index="startIndex + i"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfVirtualList' });

  const [_, bem] = createNamespace('virtual-list');

  const props = withDefaults(
    defineProps<{
      items: any[];
      height?: number | string;
      itemHeight?: number;
      overscan?: number;
      rowKey?: string | ((item: any, index: number) => string | number);
    }>(),
    {
      items: () => [],
      height: 360,
      itemHeight: 32,
      overscan: 6,
      rowKey: undefined,
    }
  );

  const root = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);

  const normalizedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height));
  const totalHeight = computed(() => props.items.length * props.itemHeight);

  const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan));
  const endIndex = computed(() => {
    const viewport = typeof props.height === 'number' ? props.height : (root.value?.clientHeight ?? 360);
    const visibleCount = Math.ceil(viewport / props.itemHeight) + props.overscan * 2;
    return Math.min(props.items.length, startIndex.value + visibleCount);
  });

  const offsetY = computed(() => startIndex.value * props.itemHeight);
  const visibleItems = computed(() => props.items.slice(startIndex.value, endIndex.value));

  const handleScroll = () => {
    if (!root.value) return;
    scrollTop.value = root.value.scrollTop;
  };

  const resolveKey = (item: any, index: number) => {
    if (typeof props.rowKey === 'function') return props.rowKey(item, index);
    if (typeof props.rowKey === 'string') return item?.[props.rowKey] ?? index;
    return item?.key ?? index;
  };
</script>

<style scoped lang="less">
  .gf-virtual-list {
    position: relative;
    overflow: auto;
    width: 100%;

    &__spacer {
      width: 1px;
      opacity: 0;
      pointer-events: none;
    }

    &__viewport {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }

    &__row {
      display: flex;
      align-items: center;
      min-width: 0;
    }
  }
</style>
