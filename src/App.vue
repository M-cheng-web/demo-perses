<template>
  <ConfigProvider :locale="locale">
    <div :class="bem()">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from 'ant-design-vue';
  import zhCN from 'ant-design-vue/es/locale/zh_CN';
  import { createNamespace } from '@/utils';

  // App 根组件
  const [_, bem] = createNamespace('app');
  const locale = zhCN;
</script>

<style scoped>
  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
