<template>
  <div :class="[bem(), 'cc-input', 'ant-input', sizeClass, { 'is-disabled': disabled }]">
    <span v-if="$slots.prefix" :class="bem('addon')">
      <slot name="prefix" />
    </span>
    <input
      ref="inputRef"
      :class="bem('control')"
      :type="type"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @change="onChange"
      @keydown.enter="onPressEnter"
    />
    <span v-if="allowClear && value" :class="bem('clear')" @click="handleClear">×</span>
    <span v-if="$slots.suffix" :class="bem('addon')">
      <slot name="suffix" />
    </span>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { createNamespace } from '@/utils';

  type InputSize = 'small' | 'middle' | 'large';

  const props = withDefaults(
    defineProps<{
      value?: string | number;
      placeholder?: string;
      size?: InputSize;
      disabled?: boolean;
      allowClear?: boolean;
      type?: string;
    }>(),
    {
      value: '',
      placeholder: '',
      size: 'middle',
      disabled: false,
      allowClear: false,
      type: 'text',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: string | number): void;
    (e: 'change', val: string | number): void;
    (e: 'input', val: string | number): void;
    (e: 'press-enter', evt: KeyboardEvent): void;
  }>();

  const [_, bem] = createNamespace('input');
  const inputRef = ref<HTMLInputElement>();

  const sizeClass = computed(() => (props.size === 'small' ? 'ant-input-sm' : ''));

  const updateValue = (val: string) => {
    const normalized = props.type === 'number' ? Number(val) : val;
    emit('update:value', normalized);
    return normalized;
  };

  const onInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const val = updateValue(target.value);
    emit('input', val);
  };

  const onChange = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const val = updateValue(target.value);
    emit('change', val);
  };

  const onPressEnter = (evt: KeyboardEvent) => {
    emit('press-enter', evt);
  };

  const handleClear = () => {
    updateValue('');
    inputRef.value?.focus();
  };
</script>

<style scoped lang="less">
  .dp-input {
    display: inline-flex;
    align-items: center;
    width: 100%;

    &__control {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
    }

    &__addon {
      display: inline-flex;
      align-items: center;
      color: var(--cc-text-secondary);
      margin: 0 4px;
      line-height: 0;
    }

    &__clear {
      cursor: pointer;
      color: var(--cc-text-secondary);
      padding: 0 4px;
      user-select: none;
    }
  }
</style>
