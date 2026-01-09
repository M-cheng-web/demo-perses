<template>
  <div :class="['cc-empty', 'ant-empty', bem()]">
    <div :class="bem('icon')">🌥️</div>
    <div :class="bem('description')">
      <slot name="description">{{ description || '暂无数据' }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '@/utils';

  defineProps<{
    description?: string;
  }>();

  const [_, bem] = createNamespace('empty');
</script>

<style scoped lang="less">
  .dp-empty {
    &__icon {
      font-size: 20px;
      margin-bottom: 6px;
    }

    &__description {
      color: var(--cc-text-secondary);
      font-size: 13px;
    }
  }
</style>
