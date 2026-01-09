<template>
  <div :class="bem()">
    <span class="dp-loading__dot" />
    <span v-if="text" class="dp-loading__text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';

  defineProps<{
    text?: string;
  }>();

  const [_, bem] = createNamespace('loading');
</script>

<style scoped lang="less">
  .dp-loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #4f94f5;

    &__dot {
      width: 18px;
      height: 18px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: loading-spin 0.8s linear infinite;
    }

    &__text {
      font-size: 13px;
    }
  }

  @keyframes loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
