<!-- 组件说明：分割线，用于分隔内容块 -->
<template>
  <div :class="bem()" role="separator"></div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfDivider' });

  const [_, bem] = createNamespace('divider');
</script>

<style scoped lang="less">
  .gf-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gf-border), transparent);
    margin: 8px 0;
  }
</style>
