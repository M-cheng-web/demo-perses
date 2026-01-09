<template>
  <div :class="[bem(), 'cc-col']" :style="colStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed, inject } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      span?: number;
      offset?: number;
    }>(),
    {
      span: 24,
      offset: 0,
    }
  );

  const [_, bem] = createNamespace('col');
  const gutter = inject<number>('cc-row-gutter', 0);

  const colStyle = computed(() => ({
    flex: `0 0 ${(props.span / 24) * 100}%`,
    maxWidth: `${(props.span / 24) * 100}%`,
    marginLeft: props.offset ? `${(props.offset / 24) * 100}%` : undefined,
    paddingLeft: gutter ? `${gutter / 2}px` : undefined,
    paddingRight: gutter ? `${gutter / 2}px` : undefined,
  }));
</script>
