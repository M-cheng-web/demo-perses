<!-- 组件说明：数字输入框，带增减按钮与边界控制 -->
<template>
  <div :class="[bem(), bem({ [`size-${size}`]: true }), { 'is-disabled': disabled }]">
    <input
      :value="displayValue"
      type="number"
      :placeholder="placeholder"
      :class="['gf-control', controlSizeClass, bem('control'), { 'gf-control--disabled': disabled }]"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      @input="handleInput"
      @change="emitChange"
      @blur="handleBlur"
    />
    <div :class="bem('actions')">
      <button type="button" aria-label="增加" @click="increase" :disabled="disabled || !canIncrease">
        <UpOutlined />
      </button>
      <button type="button" aria-label="减少" @click="decrease" :disabled="disabled || !canDecrease">
        <DownOutlined />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch } from 'vue';
  import { DownOutlined, UpOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfInputNumber' });

  const props = withDefaults(
    defineProps<{
      /** 当前值 */
      value?: number;
      /** 最小值 */
      min?: number;
      /** 最大值 */
      max?: number;
      /** 步长 */
      step?: number;
      /** 占位提示 */
      placeholder?: string;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 禁用状态 */
      disabled?: boolean;
    }>(),
    {
      value: undefined,
      min: undefined,
      max: undefined,
      step: 1,
      placeholder: '',
      size: 'middle',
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: number | undefined): void;
    (e: 'change', value: number | undefined): void;
  }>();

  const [_, bem] = createNamespace('input-number');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const innerValue = ref<number | undefined>(props.value);
  const controlSizeClass = computed(() => {
    if (props.size === 'small') return 'gf-control--size-small';
    if (props.size === 'large') return 'gf-control--size-large';
    return undefined;
  });

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val;
    }
  );

  const displayValue = computed(() => (innerValue.value ?? '') as number | string);
  const canIncrease = computed(() => {
    if (props.disabled) return false;
    if (props.max === undefined) return true;
    if (innerValue.value === undefined) return true;
    return innerValue.value < props.max;
  });
  const canDecrease = computed(() => {
    if (props.disabled) return false;
    if (props.min === undefined) return true;
    if (innerValue.value === undefined) return true;
    return innerValue.value > props.min;
  });

  const clamp = (val: number | undefined) => {
    if (val === undefined) return val;
    if (props.min !== undefined) val = Math.max(props.min, val);
    if (props.max !== undefined) val = Math.min(props.max, val);
    return val;
  };

  const updateValue = (val: number | undefined) => {
    const next = clamp(val);
    innerValue.value = next;
    emit('update:value', next);
    formItem?.onFieldChange();
  };

  const emitChange = () => {
    emit('change', innerValue.value);
  };

  const handleBlur = () => {
    formItem?.onFieldBlur();
  };

  const handleInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    updateValue(isNaN(parsed as number) ? undefined : parsed);
  };

  const increase = () => {
    if (!canIncrease.value) return;
    updateValue((innerValue.value ?? 0) + props.step);
    emitChange();
  };

  const decrease = () => {
    if (!canDecrease.value) return;
    updateValue((innerValue.value ?? 0) - props.step);
    emitChange();
  };
</script>

<style scoped lang="less">
  .gf-input-number {
    display: inline-flex;
    align-items: stretch;
    border-radius: var(--gf-radius-sm);
    overflow: hidden;
    border: 1px solid var(--gf-control-border-color, var(--gf-border));
    min-height: var(--gf-control-height-md);
    transition:
      border-color var(--gf-motion-normal) var(--gf-easing),
      box-shadow var(--gf-motion-normal) var(--gf-easing);

    &:hover {
      border-color: var(--gf-control-border-color-hover, var(--gf-border-strong));
      box-shadow: var(--gf-control-shadow-hover, 0 0 0 2px var(--gf-color-primary-soft));
    }

    &:focus-within {
      border-color: var(--gf-control-border-color-focus, var(--gf-color-focus-border));
      box-shadow: var(--gf-control-shadow-focus, var(--gf-focus-ring));
    }

    &__control {
      border: none;
      border-right: 1px solid var(--gf-control-border-color, var(--gf-border));
      min-width: 80px;
      box-shadow: none;
      -moz-appearance: textfield;
      appearance: textfield;
    }

    &__control::-webkit-outer-spin-button,
    &__control::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &__control:hover,
    &__control:focus,
    &__control:focus-visible {
      box-shadow: none;
    }

    &__actions {
      display: flex;
      flex-direction: column;
      width: 32px;
      background: var(--gf-color-surface-muted);

      button {
        flex: 1;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--gf-text-secondary);
        display: grid;
        place-items: center;
        font-size: 10px;
        transition: all 0.2s var(--gf-easing);

        &:hover {
          background: var(--gf-primary-soft);
          color: var(--gf-primary-strong);
        }

        &:first-child {
          border-bottom: 1px solid var(--gf-control-border-color, var(--gf-border));
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    &--size-small {
      min-height: var(--gf-control-height-sm);

      .gf-input-number__actions {
        width: 30px;
      }
    }

    &--size-large {
      min-height: var(--gf-control-height-lg);

      .gf-input-number__actions {
        width: 34px;
      }
    }
  }
</style>
