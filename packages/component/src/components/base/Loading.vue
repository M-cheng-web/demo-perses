<!-- 组件说明：小型加载指示器，可附带文字 -->
<template>
  <div :class="bem()">
    <span :class="bem('dot')"></span>
    <span v-if="text" :class="bem('text')">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfLoading' });

  defineProps<{
    /** 加载提示文字 */
    text?: string;
  }>();

  const [_, bem] = createNamespace('loading');
</script>

<style scoped lang="less">
  .gf-loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--gf-color-primary);

    &__dot {
      width: 18px;
      height: 18px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: loading-spin 0.8s linear infinite;
    }

    &__text {
      font-size: var(--gf-font-size-md);
      color: var(--gf-text-secondary);
    }
  }

  @keyframes loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
