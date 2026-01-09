<template>
  <ConfigProvider :locale="locale">
    <div class="dp-app">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from 'ant-design-vue';
  import zhCN from 'ant-design-vue/es/locale/zh_CN';

  const locale = zhCN;
</script>

<style scoped>
  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
