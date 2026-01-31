<template>
  <ConfigProvider theme="inherit">
    <div class="dp-app gf-app">
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
  :global(html),
  :global(body),
  :global(#app) {
    height: 100%;
    width: 100%;
  }

  :global(body) {
    margin: 0;
  }

  .dp-app {
    width: 100%;
    height: 100%;
  }
</style>
