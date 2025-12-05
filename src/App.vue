<template>
  <a-config-provider :locale="locale">
    <div id="app">
      <router-view />
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
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
