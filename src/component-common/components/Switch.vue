<template>
  <div :class="[bem(), 'cc-switch-wrapper']" @click="toggle">
    <div :class="['cc-switch', { 'cc-switch--checked': checked, 'cc-switch--small': size === 'small' }]">
      <div class="cc-switch__handle" />
    </div>
    <span v-if="checked && checkedChildren" class="cc-switch__text">{{ checkedChildren }}</span>
    <span v-else-if="!checked && unCheckedChildren" class="cc-switch__text">{{ unCheckedChildren }}</span>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      checked?: boolean;
      size?: 'small' | 'default';
      checkedChildren?: string;
      unCheckedChildren?: string;
      disabled?: boolean;
    }>(),
    {
      checked: false,
      size: 'default',
      disabled: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:checked', val: boolean): void;
    (e: 'change', val: boolean): void;
  }>();

  const [_, bem] = createNamespace('switch');

  const toggle = () => {
    if (props.disabled) return;
    const next = !props.checked;
    emit('update:checked', next);
    emit('change', next);
  };
</script>

<style scoped lang="less">
  .dp-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .cc-switch--small {
      transform: scale(0.9);
      transform-origin: left center;
    }
  }

  .cc-switch__text {
    color: var(--cc-text-secondary);
    font-size: 12px;
  }
</style>
