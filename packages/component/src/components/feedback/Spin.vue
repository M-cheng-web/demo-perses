<!-- 组件说明：加载指示器包装，可配合表格等场景 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-nested': hasContent, 'is-spinning': spinning }]">
    <div v-if="spinning" :class="bem('spinning')">
      <span :class="bem('dot')">
        <i :class="bem('dot-item')"></i>
        <i :class="bem('dot-item')"></i>
        <i :class="bem('dot-item')"></i>
        <i :class="bem('dot-item')"></i>
      </span>
      <div v-if="tip" :class="bem('text')">{{ tip }}</div>
    </div>
    <div v-if="hasContent" :class="[bem('container'), { 'is-blur': spinning }]">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useSlots, computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSpin' });

  withDefaults(
    defineProps<{
      /** 是否处于加载状态 */
      spinning?: boolean;
      /** 加载提示文字 */
      tip?: string;
      /** 尺寸 */
      size?: 'small' | 'default' | 'large';
    }>(),
    {
      spinning: true,
      tip: '',
      size: 'default',
    }
  );

  const [_, bem] = createNamespace('spin');
  const slots = useSlots();
  const hasContent = computed(() => !!slots.default);
</script>

<style scoped lang="less">
  .gf-spin {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--gf-color-primary);

    &.is-nested {
      display: block;
    }

    &__spinning {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    &.is-nested &__spinning {
      position: absolute;
      inset: 0;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.65);
    }

    &__dot {
      position: relative;
      display: inline-block;
      width: 20px;
      height: 20px;
      animation: gf-spin-rotate 1.2s linear infinite;
    }

    &__dot-item {
      position: absolute;
      width: 9px;
      height: 9px;
      background: currentColor;
      border-radius: 50%;
      opacity: 0.3;
      transform: scale(0.72);
      animation: gf-spin-dot 1.2s ease-in-out infinite;

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

    &__container {
      position: relative;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);

      &.is-blur {
        opacity: 0.5;
        pointer-events: none;
        user-select: none;
      }
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

  @keyframes gf-spin-rotate {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes gf-spin-dot {
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
