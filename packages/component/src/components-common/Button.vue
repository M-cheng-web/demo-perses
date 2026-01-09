<template>
  <button
    :class="[
      bem(),
      `gf-btn--${type}`,
      `gf-btn--${size}`,
      { 'is-block': block, 'is-loading': loading },
    ]"
    type="button"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="gf-btn__spinner" />
    <span class="gf-btn__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';

  type ButtonType = 'primary' | 'default' | 'ghost' | 'text';
  type ButtonSize = 'small' | 'middle' | 'large';

  const props = withDefaults(
    defineProps<{
      type?: ButtonType;
      size?: ButtonSize;
      block?: boolean;
      loading?: boolean;
      disabled?: boolean;
    }>(),
    {
      type: 'default',
      size: 'middle',
      block: false,
      loading: false,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'click', evt: MouseEvent): void;
  }>();

  const [_, bem] = createNamespace('button');

  const handleClick = (evt: MouseEvent) => {
    if (props.disabled || props.loading) return;
    emit('click', evt);
  };
</script>

<style scoped lang="less">
  .dp-button {
    --gf-primary: #69b1ff;
    --gf-primary-strong: #4f94f5;
    --gf-text: #132039;
    --gf-border: #d8e5f5;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--gf-border);
    background: #fff;
    color: var(--gf-text);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;

    &.gf-btn--primary {
      background: linear-gradient(135deg, var(--gf-primary), var(--gf-primary-strong));
      color: #fff;
      border-color: transparent;
      box-shadow: 0 10px 20px rgba(79, 148, 245, 0.25);
    }

    &.gf-btn--ghost {
      background: #f3f7fe;
      color: var(--gf-primary-strong);
      border-color: rgba(79, 148, 245, 0.35);
    }

    &.gf-btn--text {
      background: transparent;
      border-color: transparent;
      color: var(--gf-primary-strong);
      padding: 6px 8px;
    }

    &.gf-btn--small {
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
    }

    &.gf-btn--large {
      padding: 10px 16px;
      font-size: 14px;
    }

    &.is-block {
      width: 100%;
    }

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(79, 148, 245, 0.28);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 6px 12px rgba(79, 148, 245, 0.2);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }

    &__spinner {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: btn-spin 0.8s linear infinite;
    }
  }

  @keyframes btn-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
