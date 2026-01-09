<template>
  <div :class="[bem(), 'cc-radio-group']">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { provide, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      value?: string | number;
      buttonStyle?: 'solid' | 'outline';
      size?: 'small' | 'middle';
    }>(),
    {
      value: '',
      buttonStyle: 'solid',
      size: 'middle',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: string | number): void;
    (e: 'change', val: string | number): void;
  }>();

  const [_, bem] = createNamespace('radio-group');
  const current = ref<string | number>(props.value);

  const select = (val: string | number) => {
    current.value = val;
    emit('update:value', val);
    emit('change', val);
  };

  watch(
    () => props.value,
    (val) => (current.value = val)
  );

  provide('cc-radio-group-value', current);
  provide('cc-radio-group-select', select);
  provide('cc-radio-group-size', props.size);
  provide('cc-radio-group-style', props.buttonStyle);
</script>
