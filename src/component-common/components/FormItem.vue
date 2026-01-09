<template>
  <div :class="['cc-form-item', 'ant-form-item', bem()]">
    <label v-if="label" :class="['cc-form-item__label', { 'is-required': required }]">
      {{ label }}
    </label>
    <div class="cc-form-item__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  withDefaults(
    defineProps<{
      label?: string;
      required?: boolean;
    }>(),
    {
      label: '',
      required: false,
    }
  );

  const [_, bem] = createNamespace('form-item');
</script>

<style scoped lang="less">
  .dp-form-item {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;

    &__label {
      font-size: 13px;
      margin-bottom: 6px;
      color: var(--cc-text-secondary);

      &.is-required::after {
        content: '*';
        color: var(--cc-danger);
        margin-left: 4px;
      }
    }

    &__control {
      width: 100%;
    }
  }
</style>
