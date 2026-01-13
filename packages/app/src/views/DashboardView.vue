<template>
  <div class="dp-dashboard-view">
    <div v-if="state.dashboard" class="dp-dashboard-view__meta gf-surface">
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
        <Button size="small" type="primary" @click="actions.toggleEditMode">
          {{ state.isEditMode ? '退出编辑' : '进入编辑' }}
        </Button>
      </div>
    </div>

    <div class="dp-dashboard-view__canvas gf-glow-ring" ref="dashboardRef"></div>

    <div class="dp-dashboard-view__debug gf-surface">
      <div>容器尺寸：{{ containerSize.width }} × {{ containerSize.height }}</div>
      <div>当前 DSN：{{ api.dsn }}</div>
      <div>加载接口：{{ api.endpoints.LoadDashboard }}</div>
      <div>查询接口：{{ api.endpoints.ExecuteQueries }}</div>
      <div>挂载状态：{{ ready ? '已挂载' : '挂载中' }}</div>
      <div>主题：{{ theme }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, Segmented } from '@grafana-fast/component';
  import { useDashboardSdk, DashboardApi } from '@grafana-fast/hooks';
  import type { DashboardTheme } from '@grafana-fast/dashboard';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const { state, actions, containerSize, api, ready, mountDashboard, unmountDashboard, theme } = useDashboardSdk(dashboardRef, {
    dashboardId: 'default',
    apiConfig: {
      dsn: 'https://api.example.com',
      endpoints: {
        [DashboardApi.ExecuteQueries]: '/custom/execute',
      },
    },
  });

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

    &__debug {
      margin-top: 10px;
      padding: 12px;
      color: var(--gf-color-text-secondary);
      font-size: 12px;
      display: grid;
      gap: 6px;
    }

    &__canvas {
      flex: 1;
      min-height: 480px;
      border-radius: var(--gf-radius-md);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border-muted);
      overflow: hidden;
    }
  }
</style>
