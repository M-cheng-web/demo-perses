<template>
  <div :class="[bem(), 'cc-slider']">
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :class="bem('input')"
      @input="onInput"
      @change="onChange"
    />
    <div class="cc-slider__track" :style="trackStyle" />
    <div class="cc-slider__thumb" :style="thumbStyle" />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      value?: number;
      min?: number;
      max?: number;
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
    (e: 'update:value', val: number): void;
    (e: 'change', val: number): void;
  }>();

  const [_, bem] = createNamespace('slider');

  const percent = computed(() => ((props.value - props.min) / (props.max - props.min)) * 100);

  const trackStyle = computed(() => ({
    width: `${percent.value}%`,
  }));

  const thumbStyle = computed(() => ({
    left: `${percent.value}%`,
  }));

  const onInput = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const val = Number(target.value);
    emit('update:value', val);
  };

  const onChange = (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    const val = Number(target.value);
    emit('update:value', val);
    emit('change', val);
  };
</script>

<style scoped lang="less">
  .dp-slider {
    position: relative;

    &__input {
      position: absolute;
      inset: 0;
      opacity: 0;
    }
  }
</style>
