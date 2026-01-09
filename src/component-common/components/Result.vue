<template>
  <div :class="[bem(), 'cc-result']">
    <div :class="bem('icon')" :data-status="status">
      <slot name="icon">
        <span class="cc-result__default">{{ status }}</span>
      </slot>
    </div>
    <div :class="bem('title')">
      <slot name="title">{{ title }}</slot>
    </div>
    <div :class="bem('subtitle')">
      <slot name="subTitle">{{ subTitle }}</slot>
    </div>
    <div :class="bem('extra')">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  defineProps<{
    status?: string | number;
    title?: string;
    subTitle?: string;
  }>();

  const [_, bem] = createNamespace('result');
</script>

<style scoped lang="less">
  .dp-result {
    text-align: center;
    padding: 32px 16px;
    color: var(--cc-text);

    &__icon {
      font-size: 32px;
      margin-bottom: 12px;
      color: var(--cc-primary-strong);
    }

    &__title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    &__subtitle {
      color: var(--cc-text-secondary);
      margin-bottom: 16px;
    }
  }
</style>
