<!-- 组件说明：开关切换，支持禁用与受控 checked 状态 (AntD-inspired) -->
<template>
  <button
    :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-checked': checked, 'is-disabled': disabled, 'is-loading': loading }]"
    type="button"
    role="switch"
    :aria-checked="checked"
    :disabled="disabled || loading"
    @click="toggle"
  >
    <span :class="bem('handle')">
      <span v-if="loading" :class="bem('loading')">
        <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor" class="gf-switch-loading-icon">
          <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 0 0-94.3-139.9 437.71 437.71 0 0 0-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 googl 145.8c searching.8 42.7 79.8 97.5 105.6 158.5C googl.5 375.8 1024 googl.9 1024 512c0 19.9-16.1 36-36 36z"/>
        </svg>
      </span>
    </span>
    <span v-if="$slots.checked || $slots.unchecked" :class="bem('inner')">
      <span v-if="checked" :class="bem('inner-checked')">
        <slot name="checked"></slot>
      </span>
      <span v-else :class="bem('inner-unchecked')">
        <slot name="unchecked"></slot>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
  import { inject } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfSwitch' });

  const props = withDefaults(
    defineProps<{
      /** 是否选中 */
      checked?: boolean;
      /** 禁用状态 */
      disabled?: boolean;
      /** 加载中状态 */
      loading?: boolean;
      /** 尺寸 */
      size?: 'small' | 'default';
    }>(),
    {
      checked: false,
      disabled: false,
      loading: false,
      size: 'default',
    }
  );

  const emit = defineEmits<{
    (e: 'update:checked', value: boolean): void;
    (e: 'change', value: boolean): void;
  }>();

  const [_, bem] = createNamespace('switch');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const toggle = () => {
    if (props.disabled || props.loading) return;
    const next = !props.checked;
    emit('update:checked', next);
    emit('change', next);
    formItem?.onFieldChange();
  };
</script>

<style scoped lang="less">
  .gf-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 44px;
    height: 22px;
    border-radius: 100px;
    border: none;
    background: var(--gf-color-fill-quaternary);
    cursor: pointer;
    transition: background var(--gf-motion-fast) var(--gf-easing);
    padding: 0;
    outline: none;

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
    }

    &:hover:not(.is-disabled):not(.is-loading) {
      background: var(--gf-color-fill-tertiary);
    }

    &__handle {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 2px 4px 0 rgba(0, 35, 11, 0.2);
      transition:
        left var(--gf-motion-fast) var(--gf-easing),
        width var(--gf-motion-fast) var(--gf-easing);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: var(--gf-color-primary);

      .gf-switch-loading-icon {
        animation: gf-switch-loading-spin 1s linear infinite;
      }
    }

    &__inner {
      display: block;
      margin: 0 7px 0 25px;
      font-size: var(--gf-font-size-xs);
      color: #fff;
      line-height: 22px;
      transition: margin var(--gf-motion-fast) var(--gf-easing);
      white-space: nowrap;
    }

    // Checked state
    &.is-checked {
      background: var(--gf-color-primary);

      &:hover:not(.is-disabled):not(.is-loading) {
        background: var(--gf-color-primary-hover);
      }

      .gf-switch__handle {
        left: calc(100% - 20px);
      }

      .gf-switch__inner {
        margin: 0 25px 0 7px;
      }
    }

    // Disabled state
    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    // Loading state
    &.is-loading {
      cursor: not-allowed;
      opacity: 0.65;
    }

    // Size variant
    &--size-small {
      width: 28px;
      height: 16px;

      .gf-switch__handle {
        width: 12px;
        height: 12px;
      }

      .gf-switch__loading {
        font-size: 9px;
      }

      &.is-checked .gf-switch__handle {
        left: calc(100% - 14px);
      }

      .gf-switch__inner {
        margin: 0 5px 0 18px;
        font-size: 10px;
        line-height: 16px;
      }

      &.is-checked .gf-switch__inner {
        margin: 0 18px 0 5px;
      }
    }
  }

  @keyframes gf-switch-loading-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
