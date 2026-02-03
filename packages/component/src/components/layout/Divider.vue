<!-- 组件说明：分割线，用于分隔内容块 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`type-${type}`]: true }),
      bem({ dashed: dashed }),
      bem({ [`orientation-${orientation}`]: type === 'horizontal' && $slots.default }),
    ]"
    role="separator"
  >
    <span v-if="$slots.default && type === 'horizontal'" :class="bem('text')">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfDivider' });

  withDefaults(
    defineProps<{
      /** 分割线类型 */
      type?: 'horizontal' | 'vertical';
      /** 是否虚线 */
      dashed?: boolean;
      /** 文字位置（仅水平分割线有效） */
      orientation?: 'left' | 'center' | 'right';
    }>(),
    {
      type: 'horizontal',
      dashed: false,
      orientation: 'center',
    }
  );

  const [_, bem] = createNamespace('divider');
</script>

<style scoped lang="less">
  .gf-divider {
    &--type-horizontal {
      display: flex;
      align-items: center;
      width: 100%;
      min-width: 100%;
      margin: 24px 0;
      border-top: 1px solid var(--gf-color-border);
      clear: both;
    }

    &--type-vertical {
      display: inline-block;
      width: 1px;
      height: 0.9em;
      margin: 0 8px;
      vertical-align: middle;
      background: var(--gf-color-border);
    }

    &--dashed {
      border-style: dashed;
      background: none;
    }

    &__text {
      display: inline-block;
      padding: 0 1em;
      font-size: var(--gf-font-size-md);
      font-weight: 500;
      color: var(--gf-color-text);
      white-space: nowrap;
    }

    // With text
    &--orientation-left,
    &--orientation-center,
    &--orientation-right {
      border-top: none;

      &::before,
      &::after {
        content: '';
        flex: 1;
        border-top: 1px solid var(--gf-color-border);
      }
    }

    &--orientation-left::before {
      flex: 0 0 5%;
    }

    &--orientation-right::after {
      flex: 0 0 5%;
    }

    &--dashed&--orientation-left,
    &--dashed&--orientation-center,
    &--dashed&--orientation-right {
      &::before,
      &::after {
        border-top-style: dashed;
      }
    }
  }
</style>
