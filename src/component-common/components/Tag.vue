<template>
  <span :class="[bem(), 'cc-tag', 'ant-tag']" :style="customStyle">
    <slot />
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  const props = defineProps<{
    color?: string;
  }>();

  const [_, bem] = createNamespace('tag');

  const customStyle = computed(() => {
    if (!props.color) return undefined;
    return {
      background: props.color.includes('#') ? `${props.color}20` : undefined,
      borderColor: props.color,
      color: props.color,
    };
  });
</script>

<style scoped>
  .dp-tag {
    line-height: 1;
  }
</style>
