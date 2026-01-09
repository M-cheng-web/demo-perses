<template>
  <ConfigProvider>
    <div :class="bem()">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from '@/component-common';
  import { createNamespace } from '@/utils';

  // App 根组件
  const [_, bem] = createNamespace('app');
</script>

<style scoped>
  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
