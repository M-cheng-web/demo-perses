<!-- 组件说明：数字输入框，带增减按钮与边界控制 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem({ [`size-${resolvedSize}`]: true }), { 'is-disabled': disabled, 'is-focused': isFocused }]">
    <div :class="bem('handler-wrap')">
      <span :class="[bem('handler'), bem('handler-up'), { 'is-disabled': disabled || !canIncrease }]" @click="increase">
        <UpOutlined :class="bem('handler-icon')" />
      </span>
      <span :class="[bem('handler'), bem('handler-down'), { 'is-disabled': disabled || !canDecrease }]" @click="decrease">
        <DownOutlined :class="bem('handler-icon')" />
      </span>
    </div>
    <div :class="bem('input-wrap')">
      <input
        ref="inputRef"
        :value="displayValue"
        type="text"
        inputmode="decimal"
        :placeholder="placeholder"
        :class="bem('input')"
        :disabled="disabled"
        @input="handleInput"
        @change="emitChange"
        @blur="handleBlur"
        @focus="handleFocus"
        @keydown="handleKeyDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch } from 'vue';
  import { DownOutlined, UpOutlined } from '@ant-design/icons-vue';
  import { createNamespace } from '../../utils';
  import { useComponentSize } from '../../context/size';
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
      /** 精度 (小数位数) */
      precision?: number;
      /** 占位提示 */
      placeholder?: string;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 禁用状态 */
      disabled?: boolean;
      /** 是否只允许键盘输入 */
      keyboard?: boolean;
    }>(),
    {
      value: undefined,
      min: undefined,
      max: undefined,
      step: 1,
      precision: undefined,
      placeholder: '',
      size: undefined,
      disabled: false,
      keyboard: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: number | undefined): void;
    (e: 'change', value: number | undefined): void;
    (e: 'focus', evt: FocusEvent): void;
    (e: 'blur', evt: FocusEvent): void;
  }>();

  const [_, bem] = createNamespace('input-number');
  const resolvedSize = useComponentSize(computed(() => props.size));
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const inputRef = ref<HTMLInputElement>();
  const innerValue = ref<number | undefined>(props.value);
  const isFocused = ref(false);

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val;
    }
  );

  const displayValue = computed(() => {
    if (innerValue.value === undefined || innerValue.value === null) return '';
    if (props.precision !== undefined) {
      return innerValue.value.toFixed(props.precision);
    }
    return String(innerValue.value);
  });

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

  const formatPrecision = (val: number | undefined) => {
    if (val === undefined || props.precision === undefined) return val;
    return Number(val.toFixed(props.precision));
  };

  const updateValue = (val: number | undefined) => {
    const clamped = clamp(val);
    const formatted = formatPrecision(clamped);
    innerValue.value = formatted;
    emit('update:value', formatted);
    formItem?.onFieldChange();
  };

  const emitChange = () => {
    emit('change', innerValue.value);
  };

  const handleFocus = (evt: FocusEvent) => {
    isFocused.value = true;
    emit('focus', evt);
  };

  const handleBlur = (evt: FocusEvent) => {
    isFocused.value = false;
    // Re-clamp on blur to ensure valid value
    if (innerValue.value !== undefined) {
      updateValue(innerValue.value);
    }
    emit('blur', evt);
    formItem?.onFieldBlur();
  };

  const handleInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const value = target.value;

    // Allow empty input
    if (value === '' || value === '-') {
      innerValue.value = undefined;
      emit('update:value', undefined);
      return;
    }

    const parsed = Number(value);
    if (!isNaN(parsed)) {
      innerValue.value = parsed;
      emit('update:value', parsed);
      formItem?.onFieldChange();
    }
  };

  const handleKeyDown = (evt: KeyboardEvent) => {
    if (!props.keyboard) return;

    if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      increase();
    } else if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      decrease();
    }
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

  // Expose focus method
  defineExpose({
    focus: () => inputRef.value?.focus(),
    blur: () => inputRef.value?.blur(),
  });
</script>

<style scoped lang="less">
  .gf-input-number {
    position: relative;
    display: inline-flex;
    width: 90px;
    border-radius: var(--gf-radius-sm);
    border: 1px solid var(--gf-control-border-color, var(--gf-border));
    background: var(--gf-control-bg, var(--gf-color-surface));
    transition:
      border-color var(--gf-motion-fast) var(--gf-easing),
      box-shadow var(--gf-motion-fast) var(--gf-easing);

    &:hover:not(.is-disabled) {
      border-color: var(--gf-color-primary);

      .gf-input-number__handler-wrap {
        opacity: 1;
      }
    }

    &.is-focused:not(.is-disabled) {
      border-color: var(--gf-color-primary);
      box-shadow: 0 0 0 2px var(--gf-color-primary-soft);

      .gf-input-number__handler-wrap {
        opacity: 1;
      }
    }

    &__input-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
    }

    &__input {
      width: 100%;
      height: 100%;
      min-height: var(--gf-control-height-md);
      padding: 0 11px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--gf-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      text-align: left;

      &::placeholder {
        color: var(--gf-color-text-tertiary);
      }

      &:disabled {
        cursor: not-allowed;
        color: var(--gf-color-text-disabled);
      }

      // Hide browser number input spinners
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      -moz-appearance: textfield;
    }

    &__handler-wrap {
      position: absolute;
      top: 0;
      right: 0;
      width: 22px;
      height: 100%;
      background: var(--gf-color-surface);
      border-left: 1px solid var(--gf-border);
      border-radius: 0 var(--gf-radius-sm) var(--gf-radius-sm) 0;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transition: opacity var(--gf-motion-fast) var(--gf-easing);
    }

    &__handler {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      cursor: pointer;
      color: var(--gf-color-text-tertiary);
      font-size: 10px;
      transition:
        color var(--gf-motion-fast) var(--gf-easing),
        background var(--gf-motion-fast) var(--gf-easing);
      user-select: none;

      &:hover:not(.is-disabled) {
        color: var(--gf-color-primary);
        background: var(--gf-color-primary-soft);
      }

      &.is-disabled {
        cursor: not-allowed;
        color: var(--gf-color-text-disabled);
      }
    }

    &__handler-up {
      border-bottom: 1px solid var(--gf-border);
      border-radius: 0 var(--gf-radius-sm) 0 0;
    }

    &__handler-down {
      border-radius: 0 0 var(--gf-radius-sm) 0;
    }

    &__handler-icon {
      transform: scale(0.83333);
    }

    // Size variants
    &--size-small {
      width: 70px;

      .gf-input-number__input {
        min-height: var(--gf-control-height-sm);
        padding: 0 7px;
        font-size: var(--gf-font-size-sm);
      }

      .gf-input-number__handler-wrap {
        width: 18px;
      }

      .gf-input-number__handler {
        font-size: 8px;
      }
    }

    &--size-large {
      width: 110px;

      .gf-input-number__input {
        min-height: var(--gf-control-height-lg);
        padding: 0 11px;
        font-size: var(--gf-font-size-md);
      }

      .gf-input-number__handler-wrap {
        width: 26px;
      }

      .gf-input-number__handler {
        font-size: 12px;
      }
    }

    // Disabled state
    &.is-disabled {
      background: var(--gf-color-fill);
      cursor: not-allowed;

      &:hover {
        border-color: var(--gf-border);
      }

      .gf-input-number__handler-wrap {
        background: var(--gf-color-fill);
      }
    }
  }
</style>
