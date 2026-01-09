<template>
  <span :class="bem()" :style="tagStyle">
    <slot />
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '/#/utils';

  const props = withDefaults(
    defineProps<{
      color?: string;
    }>(),
    { color: '#69b1ff' }
  );

  const [_, bem] = createNamespace('tag');

  const tagStyle = computed(() => ({
    background: `${props.color}15`,
    border: `1px solid ${props.color}55`,
    color: props.color,
  }));
</script>

<style scoped lang="less">
  .dp-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1.4;
    gap: 6px;
  }
</style>
