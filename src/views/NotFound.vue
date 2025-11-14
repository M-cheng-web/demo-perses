<template>
  <div class="not-found">
    <a-result status="404" title="404" sub-title="页面不存在">
      <template #extra>
        <a-button type="primary" @click="goHome">返回首页</a-button>
      </template>
    </a-result>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router';

  const router = useRouter();

  const goHome = () => {
    router.push('/');
  };
</script>

<style scoped lang="less">
  .not-found {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
</style>
