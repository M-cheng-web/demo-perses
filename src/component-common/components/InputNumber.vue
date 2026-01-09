<template>
  <div :class="[bem(), 'cc-input-number', 'ant-input-number', sizeClass]">
    <input
      :class="bem('control')"
      type="number"
      :value="displayValue"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  type InputSize = 'small' | 'middle' | 'large';

  const props = withDefaults(
    defineProps<{
      value?: number | null;
      min?: number;
      max?: number;
      step?: number;
      size?: InputSize;
      placeholder?: string;
      disabled?: boolean;
    }>(),
    {
      value: null,
      min: Number.NEGATIVE_INFINITY,
      max: Number.POSITIVE_INFINITY,
      step: 1,
      size: 'middle',
      placeholder: '',
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: number | null): void;
    (e: 'change', val: number | null): void;
  }>();

  const [_, bem] = createNamespace('input-number');

  const sizeClass = computed(() => (props.size === 'small' ? 'ant-input-sm' : ''));
  const displayValue = computed(() => (props.value ?? '') as any);

  const normalize = (val: string) => {
    const num = val === '' ? null : Number(val);
    if (num === null || Number.isNaN(num)) return null;
    const clamped = Math.min(Math.max(num, props.min), props.max);
    return clamped;
  };

  const onInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const num = normalize(target.value);
    emit('update:value', num);
  };

  const onChange = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const num = normalize(target.value);
    emit('update:value', num);
    emit('change', num);
  };
</script>

<style scoped lang="less">
  .dp-input-number {
    display: inline-flex;
    width: 100%;

    &__control {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
    }
  }
</style>
