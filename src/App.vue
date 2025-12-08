<template>
  <ConfigProvider :locale="locale">
    <div id="app">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from 'ant-design-vue';
  import zhCN from 'ant-design-vue/es/locale/zh_CN';
  // App 根组件
  const locale = zhCN;
</script>

<style scoped>
  #app {
    width: 100%;
    height: 100%;
  }
</style>
