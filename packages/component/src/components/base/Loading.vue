<!-- 组件说明：小型加载指示器，可附带文字 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem({ [`size-${resolvedSize}`]: true })]">
    <span :class="bem('dot')">
      <i :class="bem('dot-item')"></i>
      <i :class="bem('dot-item')"></i>
      <i :class="bem('dot-item')"></i>
      <i :class="bem('dot-item')"></i>
    </span>
    <span v-if="text" :class="bem('text')">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';
  import { useComponentSize } from '../../context/size';

  defineOptions({ name: 'GfLoading' });

  const props = withDefaults(
    defineProps<{
      /** 加载提示文字 */
      text?: string;
      /** 尺寸 */
      size?: 'small' | 'default' | 'large';
    }>(),
    {
      text: '',
      size: undefined,
    }
  );

  const [_, bem] = createNamespace('loading');
  const globalSize = useComponentSize(computed(() => props.size));
  // Loading supports 'small' | 'default' | 'large'; map 'middle' → 'default'
  const resolvedSize = computed(() => {
    const s = globalSize.value;
    if (s === 'middle') return 'default';
    return s;
  });
</script>

<style scoped lang="less">
  .gf-loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--gf-color-primary);

    &__dot {
      position: relative;
      display: inline-block;
      width: 20px;
      height: 20px;
      animation: gf-loading-rotate 1.2s linear infinite;
    }

    &__dot-item {
      position: absolute;
      width: 9px;
      height: 9px;
      background: currentColor;
      border-radius: 50%;
      opacity: 0.3;
      transform: scale(0.72);
      animation: gf-loading-dot 1.2s ease-in-out infinite;

      &:nth-child(1) {
        top: 0;
        left: 0;
      }

      &:nth-child(2) {
        top: 0;
        right: 0;
        animation-delay: 0.3s;
      }

      &:nth-child(3) {
        bottom: 0;
        right: 0;
        animation-delay: 0.6s;
      }

      &:nth-child(4) {
        bottom: 0;
        left: 0;
        animation-delay: 0.9s;
      }
    }

    &__text {
      font-size: var(--gf-font-size-sm);
      color: var(--gf-color-primary);
    }

    // Size variants
    &--size-small &__dot {
      width: 14px;
      height: 14px;
    }

    &--size-small &__dot-item {
      width: 6px;
      height: 6px;
    }

    &--size-large &__dot {
      width: 32px;
      height: 32px;
    }

    &--size-large &__dot-item {
      width: 14px;
      height: 14px;
    }
  }

  @keyframes gf-loading-rotate {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes gf-loading-dot {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.72);
    }

    50% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
