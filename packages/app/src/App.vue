<template>
  <ConfigProvider theme="inherit">
    <div class="dp-app">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue';
  import { ConfigProvider } from '@grafana-fast/component';
  import { initDashboardTheme } from '@grafana-fast/dashboard';

  onMounted(() => {
    initDashboardTheme({ defaultPreference: 'system' });
  });
</script>

<style scoped>
  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
