<!-- 组件说明：数字输入框，带增减按钮与边界控制 -->
<template>
  <div :class="[bem(), bem(`size-${size}`), { 'is-disabled': disabled }]">
    <input
      :value="displayValue"
      type="number"
      :placeholder="placeholder"
      :class="['gf-control', bem('control'), { 'gf-control--disabled': disabled }]"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      @input="handleInput"
      @change="emitChange"
    />
    <div :class="bem('actions')">
      <button type="button" @click="increase" :disabled="disabled">+</button>
      <button type="button" @click="decrease" :disabled="disabled">-</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';

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
  const innerValue = ref<number | undefined>(props.value);

  watch(
    () => props.value,
    (val) => {
      innerValue.value = val;
    }
  );

  const displayValue = computed(() => (innerValue.value ?? '') as number | string);

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
  };

  const emitChange = () => emit('change', innerValue.value);

  const handleInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    updateValue(isNaN(parsed as number) ? undefined : parsed);
  };

  const increase = () => {
    updateValue((innerValue.value ?? 0) + props.step);
    emitChange();
  };

  const decrease = () => {
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
    border: 1px solid var(--gf-border);

    &__control {
      border: none;
      border-right: 1px solid var(--gf-border);
      min-width: 80px;
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
        transition: all 0.2s var(--gf-easing);

        &:hover {
          background: var(--gf-primary-soft);
          color: var(--gf-primary-strong);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    &--size-small .gf-control {
      padding: 6px 8px;
    }

    &--size-large .gf-control {
      padding: 12px 14px;
    }
  }
</style>
