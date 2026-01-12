<!-- 组件说明：开关切换，支持禁用与受控 checked 状态 -->
<template>
  <button :class="[bem(), { 'is-checked': checked, 'is-disabled': disabled }]" type="button" @click="toggle">
    <span :class="bem('handle')" />
  </button>
</template>

<script setup lang="ts">
	  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSwitch' });

  const props = withDefaults(
    defineProps<{
      /** 是否选中 */
      checked?: boolean;
      /** 禁用状态 */
      disabled?: boolean;
    }>(),
    {
      checked: false,
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:checked', value: boolean): void;
    (e: 'change', value: boolean): void;
  }>();

  const [_, bem] = createNamespace('switch');

  const toggle = () => {
    if (props.disabled) return;
    const next = !props.checked;
    emit('update:checked', next);
    emit('change', next);
  };
</script>

<style scoped lang="less">
  .gf-switch {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--gf-border);
    background: var(--gf-color-surface-muted);
    cursor: pointer;
    transition: all 0.25s var(--gf-easing);
    box-shadow: none;
    padding: 2px;

    &__handle {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--gf-color-surface);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
      transition: transform 0.25s var(--gf-easing), background 0.25s var(--gf-easing);
    }

    &.is-checked {
      background: var(--gf-color-primary);
      border-color: transparent;
      box-shadow: none;

      .gf-switch__handle {
        transform: translateX(20px);
        background: var(--gf-color-surface);
      }
    }

    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
