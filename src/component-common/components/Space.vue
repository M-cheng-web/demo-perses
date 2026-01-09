<template>
  <div :class="bem()" :style="styleVars">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  type SpaceSize = number | [number, number];

  const props = withDefaults(
    defineProps<{
      size?: SpaceSize;
      direction?: 'horizontal' | 'vertical';
      align?: 'start' | 'center' | 'end' | 'baseline';
      wrap?: boolean;
    }>(),
    {
      size: 8,
      direction: 'horizontal',
      align: 'center',
      wrap: false,
    }
  );

  const [_, bem] = createNamespace('space');

  const styleVars = computed(() => {
    const [gapX, gapY] = Array.isArray(props.size) ? props.size : [props.size, props.size];
    const alignMap: Record<string, string> = {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      baseline: 'baseline',
    };
    return {
      display: 'inline-flex',
      flexDirection: props.direction === 'vertical' ? 'column' : 'row',
      alignItems: alignMap[props.align],
      gap: `${gapY}px ${gapX}px`,
      flexWrap: props.wrap ? 'wrap' : 'nowrap',
    };
  });
</script>

<style scoped>
  .dp-space {
    width: auto;
  }
</style>
