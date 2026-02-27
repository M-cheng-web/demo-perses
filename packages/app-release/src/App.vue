<!-- 离线消费演示根组件：挂载 release/ bundle 的 useDashboardSdk，并提供 Dashboard 容器。 -->
<template>
  <a-layout class="page">
    <a-layout-header class="page__header">
      <a-space>
        <a-typography-title :level="4" class="page__title">grafana-fast app-release</a-typography-title>
        <a-tag color="blue">release/ install</a-tag>
      </a-space>
    </a-layout-header>

    <a-layout-content class="page__content">
      <a-space direction="vertical" style="width: 100%" :size="12">
        <a-alert v-if="errorText" type="error" :message="errorText" show-icon />
        <a-card title="Dashboard 容器" size="small">
          <div ref="containerRef" class="dashboard-container"></div>
        </a-card>
      </a-space>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useDashboardSdk } from '../vendor/grafana-fast/index.mjs';

  const containerRef = ref<HTMLElement | null>(null);
  const errorText = ref<string | null>(null);

  useDashboardSdk(containerRef, {
    enableMock: true,
    defaultApiMode: 'mock',
    createMockApiClient: async () => (await import('../vendor/grafana-fast/mock.mjs')).createMockApiClient(),
    getDashboardSessionKey: async () => {
      const { createMockApiClient } = await import('../vendor/grafana-fast/mock.mjs');
      const api = createMockApiClient();
      const res = await api.dashboard.resolveDashboardSession({ params: { dashboardKey: 'default' } });
      return res.dashboardSessionKey;
    },
    onError: (err) => {
      errorText.value = err instanceof Error ? err.message : String(err);
    },
  });
</script>

<style scoped>
  .page {
    min-height: 100vh;
    background: #f5f5f5;
  }

  .page__header {
    display: flex;
    align-items: center;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
  }

  .page__title {
    margin: 0;
  }

  .page__content {
    padding: 16px;
  }

  .dashboard-container {
    width: 100%;
    height: 70vh;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    background: #fff;
    overflow: hidden;
  }
</style>
