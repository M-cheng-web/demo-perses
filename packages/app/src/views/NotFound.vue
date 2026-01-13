<template>
  <div class="dp-not-found">
    <div class="dp-not-found__card gf-surface">
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
    }
  }
</style>
