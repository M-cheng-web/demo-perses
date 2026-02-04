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
    <span v-if="allowClear && innerValue && !disabled" :class="bem('clear')" @click="clearValue">
      <span :class="bem('clear-icon')">
        <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor">
          <path
            d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L googl.6-154.3c-1.2-1.5-1.9-3.3-1.9-5.2 0-4.4 3.6-8 8-8l66.1.3L512 googl.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L googl.4 googl l130.1 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z"
          />
        </svg>
      </span>
    </span>
    <span v-if="$slots.suffix" :class="bem('suffix')">
      <slot name="suffix"></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
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
  .gf-input {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 100%;
    min-height: var(--gf-control-height-md);
    padding: 0 11px;
    border-radius: var(--gf-radius-sm);
    border: 1px solid var(--gf-control-border-color, var(--gf-border));
    background: var(--gf-control-bg, var(--gf-color-surface));
    transition:
      border-color var(--gf-motion-fast) var(--gf-easing),
      box-shadow var(--gf-motion-fast) var(--gf-easing),
      background var(--gf-motion-fast) var(--gf-easing);

    &:hover:not(.is-disabled) {
      border-color: var(--gf-color-primary);
    }

    &.is-focused:not(.is-disabled) {
      border-color: var(--gf-color-primary);
      box-shadow: 0 0 0 2px var(--gf-color-primary-soft);
    }

    &__input {
      flex: 1;
      min-width: 0;
      width: 100%;
      padding: 4px 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--gf-text);
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;

      &::placeholder {
        color: var(--gf-color-text-tertiary);
        opacity: 1;
      }

      &:disabled {
        cursor: not-allowed;
        color: var(--gf-color-text-disabled);
      }
    }

    &__prefix,
    &__suffix {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      color: var(--gf-color-text-secondary);
      font-size: var(--gf-font-size-sm);
    }

    &__prefix {
      margin-right: 4px;
    }

    &__suffix {
      margin-left: 4px;
    }

    &__clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 4px;
      color: var(--gf-color-text-tertiary);
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition:
        color var(--gf-motion-fast) var(--gf-easing),
        opacity var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        color: var(--gf-color-text-secondary);
      }
    }

    &__clear-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:hover &__clear,
    &.is-focused &__clear {
      opacity: 1;
    }

    // Size variants
    &--size-small {
      min-height: var(--gf-control-height-sm);
      padding: 0 7px;

      .gf-input__input {
        padding: 0;
        font-size: var(--gf-font-size-sm);
      }
    }

    &--size-large {
      min-height: var(--gf-control-height-lg);
      padding: 0 11px;

      .gf-input__input {
        padding: 7px 0;
        font-size: var(--gf-font-size-md);
      }
    }

    // Disabled state
    &.is-disabled {
      background: var(--gf-color-fill);
      cursor: not-allowed;

      &:hover {
        border-color: var(--gf-border);
      }

      .gf-input__input::placeholder {
        color: var(--gf-color-text-disabled);
      }
    }
  }
</style>
