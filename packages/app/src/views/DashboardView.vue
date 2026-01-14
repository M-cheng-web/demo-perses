<template>
  <div class="dp-dashboard-view">
    <div v-if="state.dashboard" class="dp-dashboard-view__meta">
      <div class="dp-dashboard-view__status">
        <span>面板组: {{ state.panelGroups.length }}</span>
        <span>模式: {{ state.isEditMode ? '编辑' : '浏览' }}</span>
      </div>
      <div class="dp-dashboard-view__actions">
        <Segmented v-model:value="themeModel" size="small" :options="themeOptions" />
        <Button size="small" type="ghost" @click="goComponents">组件库</Button>
        <Button size="small" type="ghost" @click="reloadDashboard">重新加载</Button>
        <Button size="small" type="ghost" @click="setQuickRange">最近 5 分钟</Button>
        <Button size="small" type="ghost" @click="handleRefresh">刷新时间范围</Button>
        <Button size="small" type="ghost" @click="mountDashboard">挂载</Button>
        <Button size="small" type="ghost" @click="unmountDashboard">卸载</Button>
        <Button size="small" type="ghost" @click="debugOpen = true">调试信息</Button>
        <Button size="small" type="primary" @click="actions.toggleEditMode">
          {{ state.isEditMode ? '退出编辑' : '进入编辑' }}
        </Button>
      </div>
    </div>

    <div class="dp-dashboard-view__canvas" ref="dashboardRef"></div>

    <Modal v-model:open="debugOpen" title="调试信息" :width="560" @cancel="debugOpen = false">
      <List :items="debugItems" variant="lines" size="small" :split="false" />
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, List, Modal, Segmented } from '@grafana-fast/component';
  import { useDashboardSdk, DashboardApi } from '@grafana-fast/hooks';
  import type { DashboardTheme } from '@grafana-fast/dashboard';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const debugOpen = ref(false);
  const { state, actions, containerSize, api, ready, mountDashboard, unmountDashboard, theme } = useDashboardSdk(dashboardRef, {
    dashboardId: 'default',
    apiConfig: {
      dsn: 'https://api.example.com',
      endpoints: {
        [DashboardApi.ExecuteQueries]: '/custom/execute',
      },
    },
  });

  const debugItems = computed(() => [
    { key: 'size', label: '容器尺寸', value: `${containerSize.value.width} × ${containerSize.value.height}` },
    { key: 'dsn', label: '当前 DSN', value: api.value.dsn },
    { key: 'load', label: '加载接口', value: api.value.endpoints[DashboardApi.LoadDashboard] },
    { key: 'query', label: '查询接口', value: api.value.endpoints[DashboardApi.ExecuteQueries] },
    { key: 'ready', label: '挂载状态', value: ready.value ? '已挂载' : '挂载中' },
    { key: 'theme', label: '主题', value: theme.value },
  ]);

  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ] as const;

  const themeModel = computed({
    get: () => theme.value,
    set: (value: DashboardTheme) => {
      actions.setTheme(value);
    },
  });

  const reloadDashboard = () => actions.loadDashboard('default');
  const handleRefresh = () => actions.refreshTimeRange();
  const setQuickRange = () =>
    actions.setTimeRange({
      from: 'now-5m',
      to: 'now',
    });

  const goComponents = () => router.push('/components');
</script>

<style scoped lang="less">
  .dp-dashboard-view {
    width: 100%;
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;

    &__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      color: var(--gf-color-text);
      font-size: 13px;
      backdrop-filter: blur(12px);
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-color-border);
      border-radius: var(--gf-radius-md);
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing),
        transform var(--gf-motion-normal) var(--gf-easing);
    }

    &__status {
      display: flex;
      gap: 12px;
      color: var(--gf-color-text-secondary);
    }

    &__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    &__canvas {
      flex: 1;
      min-height: 480px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      overflow: hidden;
      position: relative;
    }

    &__canvas::after {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      border: 1px solid var(--gf-color-border-muted);
      pointer-events: none;
      box-shadow: 0 0 24px var(--gf-color-primary-soft);
    }
  }
</style>
