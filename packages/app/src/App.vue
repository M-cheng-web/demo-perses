<template>
  <ConfigProvider theme="blue">
    <div class="dp-app">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from '@grafana-fast/component';
</script>

<style scoped>
  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
