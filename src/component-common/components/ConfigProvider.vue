<template>
  <div :class="['cc-theme', bem()]">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  defineProps<{
    locale?: any;
  }>();

  const [_, bem] = createNamespace('config-provider');
</script>

<style scoped>
  .dp-config-provider {
    display: contents;
  }
</style>
