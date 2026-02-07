<!-- 组件说明：操作按钮，可配置类型、尺寸、图标、加载与危险态等 -->
<template>
  <button
    :class="[
      bem(),
      bem({
        [`type-${type}`]: true,
        [`size-${size}`]: true,
        [`shape-${effectiveShape}`]: effectiveShape !== 'default',
        block,
        danger,
        loading,
        'icon-only': iconOnly,
      }),
      { 'is-disabled': disabled || loading },
    ]"
    type="button"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" :class="bem('spinner')"></span>
    <span v-else-if="$slots.icon || icon" :class="bem('icon')">
      <slot name="icon">
        <component :is="icon" v-if="icon" />
      </slot>
    </span>
    <span v-if="$slots.default" :class="bem('content')">
      <slot></slot>
    </span>
    <span v-if="shortcutLabel" :class="bem('shortcut')" aria-hidden="true">{{ shortcutLabel }}</span>
  </button>
</template>

<script setup lang="ts">
  import { computed, type VNodeChild } from 'vue';
  import { createNamespace } from '../../utils';

  type ButtonType = 'primary' | 'default' | 'ghost' | 'text' | 'dashed' | 'link';
  type ButtonSize = 'small' | 'middle' | 'large';
  type ButtonShape = 'default' | 'square' | 'circle';

  defineOptions({ name: 'GfButton' });

  const props = withDefaults(
    defineProps<{
      /** 按钮视觉类型 */
      type?: ButtonType;
      /** 尺寸预设 */
      size?: ButtonSize;
      /** 是否铺满整行 */
      block?: boolean;
      /** 显示加载动画 */
      loading?: boolean;
      /** 禁用交互 */
      disabled?: boolean;
      /** 危险态样式 */
      danger?: boolean;
      /**
       * Icon-only 模式（常用于表格/列表/面板的右侧操作区）
       *
       * 说明：
       * - 该模式会把按钮变为固定宽高的方形按钮
       * - 默认形状为 square（可通过 shape 覆盖）
       */
      iconOnly?: boolean;
      /** 形状 */
      shape?: ButtonShape;
      /** 自定义图标渲染 */
      icon?: VNodeChild;
      /** 显示快捷键提示（如 "Ctrl+K" / ["Ctrl", "K"]） */
      shortcut?: string | string[];
    }>(),
    {
      type: 'default',
      size: 'middle',
      block: false,
      loading: false,
      disabled: false,
      danger: false,
      iconOnly: false,
      shape: 'default',
      icon: undefined,
      shortcut: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'click', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('button');

  const effectiveShape = computed<ButtonShape>(() => {
    if (props.shape && props.shape !== 'default') return props.shape;
    if (props.iconOnly) return 'square';
    return 'default';
  });

  const shortcutLabel = computed(() => {
    if (!props.shortcut) return '';
    if (Array.isArray(props.shortcut)) return props.shortcut.filter(Boolean).join('+');
    return props.shortcut;
  });

  const handleClick = (evt: MouseEvent) => {
    if (props.disabled || props.loading) return;
    emit('click', evt);
  };
</script>

<style scoped lang="less">
  // Ant Design 5.x inspired Button styles
  .gf-button {
    // CSS Variables for easy customization
    --gf-btn-bg: var(--gf-color-surface);
    --gf-btn-bg-hover: var(--gf-color-surface);
    --gf-btn-bg-active: var(--gf-color-surface);
    --gf-btn-color: var(--gf-color-text);
    --gf-btn-border: var(--gf-color-border);
    --gf-btn-border-hover: var(--gf-color-primary-hover);
    --gf-btn-shadow: 0 2px 0 rgba(0, 0, 0, 0.02);
    --gf-btn-shadow-hover: 0 2px 0 rgba(0, 0, 0, 0.02);

    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    gap: 8px;
    padding: 4px 15px;
    height: var(--gf-control-height-md, 32px);
    min-height: var(--gf-control-height-md, 32px);
    border-radius: var(--gf-radius-md);
    border: 1px solid var(--gf-btn-border);
    background: var(--gf-btn-bg);
    color: var(--gf-btn-color);
    font-size: var(--gf-font-size-md);
    font-weight: 400;
    line-height: 1.5714285714;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    touch-action: manipulation;
    transition: all var(--gf-motion-normal) var(--gf-easing);
    box-shadow: var(--gf-btn-shadow);
    box-sizing: border-box;

    // Primary button - Ant Design style
    &--type-primary {
      --gf-btn-bg: var(--gf-color-primary);
      --gf-btn-bg-hover: var(--gf-color-primary-hover);
      --gf-btn-bg-active: var(--gf-color-primary-active);
      --gf-btn-color: #fff;
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-shadow: 0 2px 0 rgba(5, 145, 255, 0.1);
      --gf-btn-shadow-hover: 0 2px 0 rgba(5, 145, 255, 0.1);
    }

    // Ghost/Outline button
    &--type-ghost {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: transparent;
      --gf-btn-bg-active: transparent;
      --gf-btn-color: var(--gf-color-primary);
      --gf-btn-border: var(--gf-color-primary);
      --gf-btn-border-hover: var(--gf-color-primary-hover);
      --gf-btn-shadow: none;
      --gf-btn-shadow-hover: none;

      &:hover:not(.is-disabled) {
        --gf-btn-color: var(--gf-color-primary-hover);
      }
    }

    // Text button - minimal style
    &--type-text {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: var(--gf-color-fill);
      --gf-btn-bg-active: var(--gf-color-fill-secondary);
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-color: var(--gf-color-text);
      --gf-btn-shadow: none;
      --gf-btn-shadow-hover: none;
      padding: 4px 8px;
    }

    // Icon-only text button - neutral hover
    &--icon-only&--type-text {
      --gf-btn-color: var(--gf-color-text-secondary);

      &:hover:not(.is-disabled) {
        --gf-btn-color: var(--gf-color-text);
      }
    }

    // Link button
    &--type-link {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: transparent;
      --gf-btn-bg-active: transparent;
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-color: var(--gf-color-primary);
      --gf-btn-shadow: none;
      --gf-btn-shadow-hover: none;
      padding: 4px 4px;
      height: auto;
      min-height: auto;

      &:hover:not(.is-disabled) {
        --gf-btn-color: var(--gf-color-primary-hover);
      }
    }

    // Dashed button
    &--type-dashed {
      --gf-btn-bg: var(--gf-color-surface);
      --gf-btn-bg-hover: var(--gf-color-surface);
      --gf-btn-color: var(--gf-color-text);
      border-style: dashed;

      &:hover:not(.is-disabled) {
        --gf-btn-color: var(--gf-color-primary);
        --gf-btn-border: var(--gf-color-primary);
      }
    }

    // Danger state - follows button type
    &--danger {
      --gf-btn-color: var(--gf-color-danger);
      --gf-btn-border: var(--gf-color-danger);
      --gf-btn-border-hover: var(--gf-color-danger-hover);

      &:hover:not(.is-disabled) {
        --gf-btn-color: var(--gf-color-danger-hover);
      }
    }

    &--danger&--type-primary {
      --gf-btn-bg: var(--gf-color-danger);
      --gf-btn-bg-hover: var(--gf-color-danger-hover);
      --gf-btn-bg-active: var(--gf-color-danger-active);
      --gf-btn-color: #fff;
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-shadow: 0 2px 0 rgba(255, 77, 79, 0.1);
    }

    &--danger&--type-ghost {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: transparent;
    }

    &--danger&--type-text,
    &--danger&--type-link {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: var(--gf-color-danger-soft);
      --gf-btn-border: transparent;
    }

    // Size variants
    &--size-small {
      padding: 0 7px;
      height: var(--gf-control-height-sm, 24px);
      min-height: var(--gf-control-height-sm, 24px);
      border-radius: var(--gf-radius-sm);
      font-size: var(--gf-font-size-sm);
      gap: 4px;
    }

    &--type-link&--size-small {
      padding: 0 4px;
      height: auto;
      min-height: auto;
    }

    &--size-large {
      padding: 6px 15px;
      height: var(--gf-control-height-lg, 40px);
      min-height: var(--gf-control-height-lg, 40px);
      font-size: var(--gf-font-size-lg);
      border-radius: var(--gf-radius-lg);
    }

    // Block button
    &--block {
      width: 100%;
    }

    // Icon-only button
    &--icon-only {
      padding: 0;
      width: var(--gf-btn-icon-only-size, 32px);
      height: var(--gf-btn-icon-only-size, 32px);
      min-height: var(--gf-btn-icon-only-size, 32px);
      gap: 0;
    }

    &--size-small&--icon-only {
      --gf-btn-icon-only-size: 24px;
    }

    &--size-middle&--icon-only {
      --gf-btn-icon-only-size: 32px;
    }

    &--size-large&--icon-only {
      --gf-btn-icon-only-size: 40px;
    }

    // Shape variants
    &--shape-circle {
      border-radius: 50%;
    }

    // Interactive states
    &:hover:not(.is-disabled) {
      background: var(--gf-btn-bg-hover);
      border-color: var(--gf-btn-border-hover);
      color: var(--gf-btn-color);
      box-shadow: var(--gf-btn-shadow-hover);
    }

    &:active:not(.is-disabled) {
      background: var(--gf-btn-bg-active);
      transition-duration: 0ms;
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--gf-focus-ring);
    }

    // Disabled state
    &.is-disabled {
      cursor: not-allowed;
      border-color: var(--gf-color-border);
      color: var(--gf-color-text-disabled);
      background: var(--gf-color-fill);
      box-shadow: none;
    }

    &--type-primary.is-disabled {
      background: rgba(0, 0, 0, 0.04);
      border-color: var(--gf-color-border);
    }

    &--type-text.is-disabled,
    &--type-link.is-disabled,
    &--type-ghost.is-disabled {
      background: transparent;
      border-color: transparent;
    }

    // Loading state
    &--loading .gf-button__content {
      opacity: 0.65;
    }

    // Icon
    &__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;

      .gf-button--size-large & {
        font-size: 16px;
      }
    }

    // Loading spinner
    &__spinner {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: gf-btn-spin 1s linear infinite;

      .gf-button--size-large & {
        width: 16px;
        height: 16px;
      }
    }

    // Shortcut hint
    &__shortcut {
      margin-left: 4px;
      padding: 0 6px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      border-radius: var(--gf-radius-xs);
      border: 1px solid var(--gf-color-kbd-border);
      background: var(--gf-color-kbd-bg);
      color: var(--gf-color-kbd-text);
      font-size: 12px;
      line-height: 1;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0;
      white-space: nowrap;
    }
  }

  @keyframes gf-btn-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
