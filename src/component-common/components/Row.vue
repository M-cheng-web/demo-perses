<template>
  <div :class="[bem(), 'cc-row']" :style="rowStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed, provide } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      gutter?: number;
      justify?: 'start' | 'end' | 'center' | 'space-between' | 'space-around';
      align?: 'top' | 'middle' | 'bottom';
    }>(),
    {
      gutter: 0,
      justify: 'start',
      align: 'top',
    }
  );

  const [_, bem] = createNamespace('row');

  const rowStyle = computed(() => ({
    marginLeft: props.gutter ? `-${props.gutter / 2}px` : undefined,
    marginRight: props.gutter ? `-${props.gutter / 2}px` : undefined,
    justifyContent: props.justify === 'start' ? 'flex-start' : props.justify === 'end' ? 'flex-end' : props.justify,
    alignItems: props.align === 'middle' ? 'center' : props.align === 'bottom' ? 'flex-end' : 'flex-start',
    display: 'flex',
    flexWrap: 'wrap',
    gap: props.gutter ? `${props.gutter}px` : undefined,
  }));

  provide('cc-row-gutter', props.gutter);
</script>
