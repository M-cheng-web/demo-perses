<template>
  <ConfigProvider theme="light">
    <div class="dp-app">
      <router-view />
    </div>
  </ConfigProvider>
</template>

<script setup lang="ts">
  import { ConfigProvider } from '@grafana-fast/component';
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
