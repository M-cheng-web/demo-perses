<template>
  <div class="not-found">
    <Result status="404" title="404" sub-title="页面不存在">
      <template #extra>
        <Button type="primary" @click="goHome">返回首页</Button>
      </template>
    </Result>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { Result, Button } from 'ant-design-vue';

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
