<!-- 组件说明：基础输入框，支持清空、前后缀、尺寸控制 -->
<template>
  <div :class="[bem(), bem(`size-${size}`), { 'is-disabled': disabled }]">
    <span v-if="$slots.prefix" :class="bem('addon')">
      <slot name="prefix"></slot>
    </span>
    <input
      :value="innerValue"
      :type="type"
      :placeholder="placeholder"
      :class="[bem('control'), 'gf-control', { 'gf-control--disabled': disabled }]"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      @input="handleInput"
      @change="handleChange"
      @keydown.enter="handlePressEnter"
    />
    <button v-if="allowClear && innerValue" :class="bem('clear')" type="button" @click="clearValue">×</button>
    <span v-if="$slots.suffix" :class="bem('addon')">
      <slot name="suffix"></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { createNamespace } from '../../utils';

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
  }>();

  const [_, bem] = createNamespace('input');
  const innerValue = ref<string | number>(props.value ?? '');

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
  };

  const handleChange = () => {
    emit('change', innerValue.value);
  };

  const handlePressEnter = () => {
    emit('press-enter', innerValue.value);
  };

  const clearValue = () => {
    innerValue.value = '';
    emit('update:value', '');
    emit('change', '');
  };
</script>

<style scoped lang="less">
  .gf-input {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 100%;
    gap: 6px;

    &__control {
      flex: 1;
      min-width: 0;
    }

    &__addon {
      display: inline-flex;
      align-items: center;
      color: var(--gf-text-secondary);
      font-size: 12px;
    }

    &__clear {
      border: none;
      background: transparent;
      color: var(--gf-text-secondary);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: var(--gf-radius-xs);
      transition: all 0.2s var(--gf-easing);

      &:hover {
        color: var(--gf-primary-strong);
        background: var(--gf-primary-soft);
      }
    }

    &__control.gf-control {
      padding-right: 10px;
      padding-left: 10px;
    }

    &--size-small .gf-control {
      padding: 6px 10px;
      font-size: 12px;
    }

    &--size-large .gf-control {
      padding: 11px 14px;
      font-size: 14px;
    }

    &.is-disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }
</style>
