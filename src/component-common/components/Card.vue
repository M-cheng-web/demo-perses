<template>
  <div :class="[bem(), 'cc-card', 'ant-card', { 'is-borderless': !bordered }]">
    <div v-if="$slots.title || title" :class="['ant-card-head', bem('head')]">
      <div :class="['ant-card-head-title', bem('title')]">
        <slot name="title">{{ title }}</slot>
      </div>
    </div>
    <div :class="['ant-card-body', bem('body')]">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  withDefaults(
    defineProps<{
      title?: string;
      bordered?: boolean;
      size?: 'small' | 'default';
    }>(),
    {
      bordered: true,
      size: 'default',
    }
  );

  const [_, bem] = createNamespace('card');
</script>

<style scoped lang="less">
  .dp-card {
    &.is-borderless {
      border: none;
      box-shadow: none;
    }
  }
</style>
