<!-- 组件说明：基础输入框，支持清空、前后缀、尺寸控制 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      { 'is-disabled': disabled, 'is-focused': isFocused, 'has-prefix': $slots.prefix, 'has-suffix': $slots.suffix || (allowClear && innerValue) },
    ]"
  >
    <span v-if="$slots.prefix" :class="bem('prefix')">
      <slot name="prefix"></slot>
    </span>
    <input
      ref="inputRef"
      :value="innerValue"
      :type="type"
      :placeholder="placeholder"
      :class="[bem('input')]"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      @input="handleInput"
      @change="handleChange"
      @blur="handleBlur"
      @focus="handleFocus"
      @keydown.enter="handlePressEnter"
    />
    <span v-if="allowClear && innerValue && !disabled" :class="bem('clear')" @mousedown.prevent @click="clearValue">
      <span :class="bem('clear-icon')">
        <CloseCircleFilled />
      </span>
    </span>
    <span v-if="$slots.suffix" :class="bem('suffix')">
      <slot name="suffix"></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
  import { CloseCircleFilled } from '@ant-design/icons-vue';
  import { inject, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfInput' });

  const props = withDefaults(
    defineProps<{
      /** 受控值 */
      value?: string | number;
      /** 占位提示 */
      placeholder?: string;
      /** 禁用状态 */
      disabled?: boolean;
      /** 是否展示清空按钮 */
      allowClear?: boolean;
      /** 尺寸 */
      size?: 'small' | 'middle' | 'large';
      /** 输入类型 */
      type?: string;
      /** 只读模式 */
      readonly?: boolean;
      /** 浏览器自动完成 */
      autocomplete?: string;
    }>(),
    {
      value: '',
      placeholder: '',
      disabled: false,
      allowClear: false,
      size: 'middle',
      type: 'text',
      readonly: false,
      autocomplete: 'off',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: string | number): void;
    (e: 'change', value: string | number): void;
    (e: 'input', value: string | number): void;
    (e: 'press-enter', value: string | number): void;
    (e: 'focus', evt: FocusEvent): void;
    (e: 'blur', evt: FocusEvent): void;
  }>();

  const [_, bem] = createNamespace('input');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);
  const inputRef = ref<HTMLInputElement>();
  const innerValue = ref<string | number>(props.value ?? '');
  const isFocused = ref(false);

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val ?? '';
    }
  );

  const handleInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    innerValue.value = target.value;
    emit('update:value', innerValue.value);
    emit('input', innerValue.value);
    formItem?.onFieldChange();
  };

  const handleChange = () => {
    emit('change', innerValue.value);
  };

  const handleFocus = (evt: FocusEvent) => {
    isFocused.value = true;
    emit('focus', evt);
  };

  const handleBlur = (evt: FocusEvent) => {
    isFocused.value = false;
    emit('blur', evt);
    formItem?.onFieldBlur();
  };

  const handlePressEnter = () => {
    emit('press-enter', innerValue.value);
  };

  const clearValue = () => {
    innerValue.value = '';
    emit('update:value', '');
    emit('change', '');
    formItem?.onFieldChange();
    inputRef.value?.focus();
  };

  // Expose focus method
  defineExpose({
    focus: () => inputRef.value?.focus(),
    blur: () => inputRef.value?.blur(),
  });
</script>

<style scoped lang="less">
  // Ant Design 5.x inspired Input styles
  .gf-input {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 100%;
    height: var(--gf-control-height-md);
    min-height: var(--gf-control-height-md);
    padding: 0 11px;
    border-radius: var(--gf-radius-md);
    border: 1px solid var(--gf-color-border);
    background: var(--gf-color-surface);
    color: var(--gf-color-text);
    font-size: var(--gf-font-size-md);
    line-height: 1.5714285714;
    transition: all var(--gf-motion-normal) var(--gf-easing);

    // Hover state
    &:hover:not(.is-disabled) {
      border-color: var(--gf-color-primary-hover);
    }

    // Focus state - Ant Design style
    &.is-focused:not(.is-disabled) {
      border-color: var(--gf-color-primary);
      box-shadow: var(--gf-focus-ring);
      outline: none;
    }

    // Inner input element
    &__input {
      flex: 1;
      min-width: 0;
      width: 100%;
      padding: 4px 0;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
      font-size: inherit;
      line-height: inherit;
      font-family: inherit;

      &::placeholder {
        color: var(--gf-color-text-placeholder);
        opacity: 1;
      }

      &:disabled {
        cursor: not-allowed;
        color: var(--gf-color-text-disabled);

        &::placeholder {
          color: var(--gf-color-text-disabled);
        }
      }
    }

    // Prefix and suffix
    &__prefix,
    &__suffix {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      color: var(--gf-color-text-quaternary);
      font-size: var(--gf-font-size-md);
      transition: color var(--gf-motion-fast) var(--gf-easing);
    }

    &__prefix {
      margin-right: 8px;
    }

    &__suffix {
      margin-left: 8px;
    }

    // Clear button
    &__clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      margin-left: 6px;
      color: var(--gf-color-text-quaternary);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: all var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-color-text-secondary);
      }

      &:active {
        color: var(--gf-color-text);
      }
    }

    &__clear-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    // Show clear button on hover/focus
    &:hover &__clear,
    &.is-focused &__clear {
      opacity: 1;
    }

    // Size variants
    &--size-small {
      height: var(--gf-control-height-sm);
      min-height: var(--gf-control-height-sm);
      padding: 0 7px;
      border-radius: var(--gf-radius-sm);
      font-size: var(--gf-font-size-sm);

      .gf-input__input {
        padding: 0;
      }

      .gf-input__prefix {
        margin-right: 4px;
      }

      .gf-input__suffix {
        margin-left: 4px;
      }

      .gf-input__clear {
        width: 14px;
        height: 14px;
        margin-left: 4px;
        font-size: 12px;
      }
    }

    &--size-large {
      height: var(--gf-control-height-lg);
      min-height: var(--gf-control-height-lg);
      padding: 0 11px;
      border-radius: var(--gf-radius-lg);
      font-size: var(--gf-font-size-lg);

      .gf-input__input {
        padding: 7px 0;
      }

      .gf-input__clear {
        width: 18px;
        height: 18px;
        font-size: 15px;
      }
    }

    // Disabled state
    &.is-disabled {
      background: var(--gf-color-fill);
      border-color: var(--gf-color-border);
      color: var(--gf-color-text-disabled);
      cursor: not-allowed;

      &:hover {
        border-color: var(--gf-color-border);
      }
    }

    // Status variants (for form validation)
    &.is-error {
      border-color: var(--gf-color-danger);

      &:hover:not(.is-disabled) {
        border-color: var(--gf-color-danger-hover);
      }

      &.is-focused:not(.is-disabled) {
        border-color: var(--gf-color-danger);
        box-shadow: var(--gf-focus-ring-error);
      }
    }

    &.is-warning {
      border-color: var(--gf-color-warning);

      &:hover:not(.is-disabled) {
        border-color: var(--gf-color-warning-hover);
      }

      &.is-focused:not(.is-disabled) {
        border-color: var(--gf-color-warning);
        box-shadow: var(--gf-focus-ring-warning);
      }
    }
  }
</style>
