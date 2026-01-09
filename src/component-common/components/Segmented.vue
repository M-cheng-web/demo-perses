<template>
  <div :class="['cc-segmented', bem()]">
    <div
      v-for="option in options"
      :key="option.value"
      :class="['cc-segmented__item', { 'is-active': option.value === model }]"
      @click="handleSelect(option.value)"
    >
      {{ option.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '@/utils';

  interface SegmentedOption {
    label: string;
    value: string | number;
  }

  const props = withDefaults(
    defineProps<{
      options: SegmentedOption[];
      value?: string | number;
      size?: 'small' | 'middle';
    }>(),
    {
      options: () => [],
      size: 'middle',
    }
  );

  const emit = defineEmits<{
    (e: 'update:value', val: string | number): void;
    (e: 'change', val: string | number): void;
  }>();

  const [_, bem] = createNamespace('segmented');

  const model = computed(() => props.value);

  const handleSelect = (val: string | number) => {
    emit('update:value', val);
    emit('change', val);
  };
</script>
