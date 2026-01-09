<template>
  <div :class="bem()">
    <div :class="bem('icon')">🌤️</div>
    <div :class="bem('title')">{{ description || '暂无数据' }}</div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '/#/utils';

  defineProps<{
    description?: string;
  }>();

  const [_, bem] = createNamespace('empty');
</script>

<style scoped lang="less">
  .dp-empty {
    background: #f6f9ff;
    border: 1px dashed #d8e5f5;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    color: #56627a;
    display: grid;
    gap: 6px;
    place-items: center;

    &__icon {
      font-size: 20px;
    }

    &__title {
      font-size: 13px;
    }
  }
</style>
