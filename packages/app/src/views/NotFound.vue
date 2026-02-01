<!--
  页面说明：NotFound（404）路由页

  用途：
  - 当访问不存在的路由时展示兜底页面
  - 提供返回首页的快捷操作
-->
<template>
  <div class="dp-not-found">
    <div class="dp-not-found__card">
      <Alert type="error" show-icon message="404" description="页面不存在" />
      <Button type="primary" @click="goHome">返回首页</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { Alert, Button } from '@grafana-fast/component';

  const router = useRouter();

  const goHome = () => {
    router.push('/');
  };
</script>

<style scoped lang="less">
  .dp-not-found {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;

    &__card {
      width: min(520px, 92vw);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing);
    }

    &__card:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
    }
  }
</style>
