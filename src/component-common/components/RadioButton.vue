<template>
  <div
    :class="[
      bem(),
      'cc-radio-button',
      'ant-radio-button-wrapper',
      { 'is-checked': isChecked, 'ant-radio-button-wrapper-checked': isChecked, 'ant-radio-button-wrapper-sm': size === 'small' },
    ]"
    @click="handleClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed, inject } from 'vue';
  import { createNamespace } from '@/utils';

  const props = defineProps<{
    value: string | number;
  }>();

  const [_, bem] = createNamespace('radio-button');
  const current = inject('cc-radio-group-value') as any;
  const select = inject<(val: string | number) => void>('cc-radio-group-select');
  const size = inject<'small' | 'middle'>('cc-radio-group-size', 'middle');

  const isChecked = computed(() => current?.value === props.value);

  const handleClick = () => {
    select?.(props.value);
  };
</script>
