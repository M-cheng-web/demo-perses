<template>
  <div :class="bem()" :style="flexStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      gap?: number;
      justify?: 'start' | 'end' | 'center' | 'space-between' | 'space-around';
      align?: 'start' | 'center' | 'end' | 'stretch';
      direction?: 'row' | 'column';
    }>(),
    {
      gap: 0,
      justify: 'start',
      align: 'start',
      direction: 'row',
    }
  );

  const [_, bem] = createNamespace('flex');

  const flexStyle = computed(() => ({
    display: 'flex',
    gap: props.gap ? `${props.gap}px` : undefined,
    justifyContent:
      props.justify === 'start' ? 'flex-start' : props.justify === 'end' ? 'flex-end' : props.justify,
    alignItems:
      props.align === 'start' ? 'flex-start' : props.align === 'end' ? 'flex-end' : props.align,
    flexDirection: props.direction,
  }));
</script>
