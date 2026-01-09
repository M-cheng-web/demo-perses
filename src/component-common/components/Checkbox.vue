<template>
  <label :class="[bem(), 'cc-checkbox', 'ant-checkbox-wrapper', { 'is-disabled': disabled }]" @click.prevent="toggle">
    <span :class="[bem('box'), 'cc-checkbox__box', { 'cc-checkbox__box--checked': checked, 'cc-checkbox__box--indeterminate': indeterminate }]">
      <span v-if="checked" class="cc-checkbox__mark">✔</span>
      <span v-else-if="indeterminate" class="cc-checkbox__mark">−</span>
    </span>
    <span :class="bem('label')">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      checked?: boolean;
      disabled?: boolean;
      indeterminate?: boolean;
      value?: any;
    }>(),
    {
      checked: false,
      disabled: false,
      indeterminate: false,
    }
  );

  const emit = defineEmits<{
    (e: 'update:checked', val: boolean): void;
    (e: 'change', val: boolean): void;
  }>();

  const [_, bem] = createNamespace('checkbox');

  const toggle = () => {
    if (props.disabled) return;
    const next = !props.checked;
    emit('update:checked', next);
    emit('change', next);
  };
</script>

<style scoped lang="less">
  .dp-checkbox {
    user-select: none;
  }

  .cc-checkbox__mark {
    font-size: 12px;
    line-height: 1;
  }
</style>
