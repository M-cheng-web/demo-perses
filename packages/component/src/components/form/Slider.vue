<!-- 组件说明：简单滑块，支持最小/最大/步长控制 -->
<template>
  <div :class="bem()">
    <input type="range" :min="min" :max="max" :step="step" :value="value" :class="bem('track')" @input="handleInput" />
    <div :class="bem('value')">{{ value }}</div>
  </div>
</template>

<script setup lang="ts">
  import { inject } from 'vue';
  import { createNamespace } from '../../utils';
  import { gfFormItemContextKey, type GfFormItemContext } from './context';

  defineOptions({ name: 'GfSlider' });

  withDefaults(
    defineProps<{
      /** 当前值 */
      value?: number;
      /** 最小值 */
      min?: number;
      /** 最大值 */
      max?: number;
      /** 步长 */
      step?: number;
    }>(),
    {
      value: 0,
      min: 0,
      max: 100,
      step: 1,
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', value: number): void;
    (e: 'change', value: number): void;
  }>();

  const [_, bem] = createNamespace('slider');
  const formItem = inject<GfFormItemContext | null>(gfFormItemContextKey, null);

  const handleInput = (evt: Event) => {
    const val = Number((evt.target as HTMLInputElement).value);
    emit('update:value', val);
    emit('change', val);
    formItem?.onFieldChange();
  };
</script>

<style scoped lang="less">
  .gf-slider {
    display: flex;
    align-items: center;
    gap: 10px;

    &__track {
      flex: 1;
      appearance: none;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--gf-color-primary-soft-active), var(--gf-color-primary));
      outline: none;

      &::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--gf-color-surface);
        border: 2px solid var(--gf-primary-strong);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
        cursor: pointer;
        transition: transform 0.2s var(--gf-easing);
      }

      &::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--gf-color-surface);
        border: 2px solid var(--gf-primary-strong);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
        cursor: pointer;
        transition: transform 0.2s var(--gf-easing);
      }
    }

    &__value {
      min-width: 40px;
      text-align: right;
      color: var(--gf-text-secondary);
      font-size: 12px;
    }
  }
</style>
