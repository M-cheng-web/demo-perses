<!-- 组件说明：空状态占位，显示图标与提示文案 -->
<template>
  <div :class="bem()">
    <div :class="bem('icon')">🌤️</div>
    <div :class="bem('title')">{{ description || '暂无数据' }}</div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfEmpty' });

  defineProps<{
    /** 自定义空状态描述 */
    description?: string;
  }>();

  const [_, bem] = createNamespace('empty');
</script>

<style scoped lang="less">
  .gf-empty {
    background: var(--gf-color-surface);
    border: 1px dashed var(--gf-border);
    border-radius: var(--gf-radius-md);
    padding: 20px;
    text-align: center;
    color: var(--gf-text-secondary);
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
