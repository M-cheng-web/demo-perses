<template>
  <form :class="[bem(), 'cc-form', `cc-form--${layout}`]" @submit.prevent>
    <slot />
  </form>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  withDefaults(
    defineProps<{
      model?: any;
      layout?: 'horizontal' | 'vertical';
      labelCol?: Record<string, any>;
    }>(),
    {
      layout: 'horizontal',
    }
  );

  const [_, bem] = createNamespace('form');
</script>
