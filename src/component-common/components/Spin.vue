<template>
  <div :class="[bem(), 'cc-spin', 'ant-spin', { 'is-spinning': spinning }]" :style="{ minHeight: inline ? 'auto' : '24px' }">
    <template v-if="spinning">
      <span class="cc-spin__dot" />
      <span v-if="tip" :class="bem('tip')">{{ tip }}</span>
    </template>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  withDefaults(
    defineProps<{
      spinning?: boolean;
      tip?: string;
      inline?: boolean;
    }>(),
    {
      spinning: true,
      tip: '',
      inline: false,
    }
  );

  const [_, bem] = createNamespace('spin');
</script>

<style scoped lang="less">
  .dp-spin {
    &__tip {
      color: var(--cc-text-secondary);
      font-size: 12px;
    }
  }
</style>
