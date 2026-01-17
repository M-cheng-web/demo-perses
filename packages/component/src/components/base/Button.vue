<!-- 组件说明：操作按钮，可配置类型、尺寸、图标、加载与危险态等 -->
<template>
  <button
    :class="[bem(), bem({ [`type-${type}`]: true, [`size-${size}`]: true, block, danger, loading }), { 'is-disabled': disabled || loading }]"
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
    <span :class="bem('content')">
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
      icon: undefined,
      shortcut: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'click', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('button');

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
  .gf-button {
    --gf-btn-bg: var(--gf-color-surface);
    --gf-btn-bg-hover: var(--gf-color-surface-muted);
    --gf-btn-bg-active: var(--gf-color-surface-muted);
    --gf-btn-color: var(--gf-color-text);
    --gf-btn-border: var(--gf-color-border);
    --gf-btn-border-hover: var(--gf-color-border-strong);
    --gf-btn-shadow: none;
    --gf-btn-shadow-hover: var(--gf-shadow-1);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    gap: 6px;
    padding: 6px 10px;
    min-height: var(--gf-control-height-md, 32px);
    border-radius: var(--gf-radius-sm);
    border: 1px solid var(--gf-btn-border);
    background: var(--gf-btn-bg);
    color: var(--gf-btn-color);
    font-size: var(--gf-font-size-sm);
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--gf-motion-normal) var(--gf-easing),
      border-color var(--gf-motion-normal) var(--gf-easing),
      box-shadow var(--gf-motion-normal) var(--gf-easing),
      color var(--gf-motion-normal) var(--gf-easing);
    box-shadow: var(--gf-btn-shadow);

    &--type-primary {
      --gf-btn-bg: var(--gf-color-primary);
      --gf-btn-bg-hover: var(--gf-color-primary-hover);
      --gf-btn-bg-active: var(--gf-color-primary-active);
      --gf-btn-color: #fff;
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-shadow-hover: var(--gf-shadow-1);
    }

    &--type-ghost {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: var(--gf-color-primary-soft-hover);
      --gf-btn-bg-active: var(--gf-color-primary-soft-active);
      --gf-btn-color: var(--gf-color-primary);
      --gf-btn-border: var(--gf-color-primary-border);
      --gf-btn-border-hover: var(--gf-color-primary-border-strong);
    }

    &--type-text {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: var(--gf-color-primary-soft-hover);
      --gf-btn-bg-active: var(--gf-color-primary-soft-active);
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-color: var(--gf-color-primary);
      --gf-btn-shadow-hover: none;
      padding: 6px 8px;
    }

    &--type-link {
      --gf-btn-bg: transparent;
      --gf-btn-bg-hover: var(--gf-color-primary-soft-hover);
      --gf-btn-bg-active: var(--gf-color-primary-soft-active);
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-color: var(--gf-color-primary);
      --gf-btn-shadow-hover: none;
      padding: 4px 6px;
      text-decoration: underline;
    }

    &--type-dashed {
      --gf-btn-bg: var(--gf-color-surface);
      --gf-btn-bg-hover: var(--gf-color-surface-muted);
      --gf-btn-color: var(--gf-color-primary);
      border-style: dashed;
    }

    &--danger {
      --gf-btn-bg: var(--gf-color-danger);
      --gf-btn-bg-hover: #d84d60;
      --gf-btn-bg-active: #c74355;
      --gf-btn-border: transparent;
      --gf-btn-border-hover: transparent;
      --gf-btn-color: #fff;
      --gf-btn-shadow-hover: var(--gf-shadow-1);
    }

    &--size-small {
      padding: 5px 8px;
      min-height: var(--gf-control-height-sm, 26px);
      border-radius: var(--gf-radius-xs);
      font-size: var(--gf-font-size-xs);
      gap: 5px;
    }

    &--size-large {
      padding: 8px 12px;
      min-height: var(--gf-control-height-lg, 36px);
      font-size: var(--gf-font-size-lg);
    }

    &--block {
      width: 100%;
    }

    &:hover:not(.is-disabled) {
      background: var(--gf-btn-bg-hover);
      border-color: var(--gf-btn-border-hover);
      box-shadow: var(--gf-btn-shadow-hover);
    }

    &:active:not(.is-disabled) {
      background: var(--gf-btn-bg-active);
    }

    &.is-disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
      filter: saturate(0.8);
    }

    &--loading .gf-button__content {
      opacity: 0.8;
    }

    &__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    &__spinner {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: btn-spin 0.8s linear infinite;
    }

    &__shortcut {
      margin-left: 2px;
      padding: 0 6px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      border-radius: var(--gf-radius-xs);
      border: 1px solid var(--gf-color-kbd-border);
      background: var(--gf-color-kbd-bg);
      color: var(--gf-color-kbd-text);
      font-size: 11px;
      line-height: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
  }

  @keyframes btn-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
