<!-- 离线消费演示根组件：挂载 release/ bundle 的 useDashboardSdk，并展示 SDK 状态。 -->
<template>
  <a-layout class="page">
    <a-layout-header class="page__header">
      <a-space>
        <a-typography-title :level="4" class="page__title">grafana-fast app-release</a-typography-title>
        <a-tag color="blue">release/ install</a-tag>
      </a-space>
    </a-layout-header>

    <a-layout-content class="page__content">
      <a-row :gutter="16">
        <a-col :xs="24" :lg="8">
          <a-card title="SDK 状态" size="small">
            <a-space direction="vertical" style="width: 100%">
              <a-alert v-if="errorText" type="error" :message="errorText" show-icon />
              <a-descriptions size="small" :column="1" bordered>
                <a-descriptions-item label="mounted">{{ state.mounted }}</a-descriptions-item>
                <a-descriptions-item label="ready">{{ state.ready }}</a-descriptions-item>
                <a-descriptions-item label="bootStage">{{ state.bootStage }}</a-descriptions-item>
                <a-descriptions-item label="theme">{{ state.theme }}</a-descriptions-item>
                <a-descriptions-item label="readOnly">{{ state.readOnly }}</a-descriptions-item>
                <a-descriptions-item label="dashboard">{{ state.dashboard?.name ?? '-' }}</a-descriptions-item>
              </a-descriptions>

              <a-space wrap>
                <a-button size="small" @click="actions.toggleTheme()">切换主题</a-button>
                <a-button size="small" @click="actions.refreshTimeRange()">刷新</a-button>
                <a-button size="small" @click="actions.setReadOnly(!state.readOnly)">
                  {{ state.readOnly ? '关闭只读' : '开启只读' }}
                </a-button>
              </a-space>
            </a-space>
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="16">
          <a-card title="Dashboard 容器" size="small">
            <div ref="containerRef" class="dashboard-container"></div>
          </a-card>
        </a-col>
      </a-row>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
  import { onUnmounted, ref } from 'vue';
  import { useDashboardSdk } from '../vendor/grafana-fast/index.mjs';
  import type { DashboardSdkStateSnapshot } from '../vendor/grafana-fast/index.mjs';

  const containerRef = ref<HTMLElement | null>(null);
  const errorText = ref<string | null>(null);

  const sdk = useDashboardSdk(containerRef, {
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

  const state = ref<DashboardSdkStateSnapshot>(sdk.getState());
  const unsubChange = sdk.on('change', ({ state: next }) => {
    state.value = next;
  });
  const unsubError = sdk.on('error', ({ error }) => {
    errorText.value = error instanceof Error ? error.message : String(error);
  });

  onUnmounted(() => {
    unsubChange();
    unsubError();
  });

  const actions = sdk.actions;
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
