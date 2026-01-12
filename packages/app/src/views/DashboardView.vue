<template>
  <div class="dp-dashboard-view">
    <div v-if="state.dashboard" class="dp-dashboard-view__meta">
      <div class="dp-dashboard-view__status">
        <span>面板组: {{ state.panelGroups.length }}</span>
        <span>模式: {{ state.isEditMode ? '编辑' : '浏览' }}</span>
      </div>
      <div class="dp-dashboard-view__actions">
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

    <div class="dp-dashboard-view__canvas" ref="dashboardRef"></div>

    <div class="dp-dashboard-view__debug">
      <div>容器尺寸：{{ containerSize.width }} × {{ containerSize.height }}</div>
      <div>当前 DSN：{{ api.dsn }}</div>
      <div>加载接口：{{ api.endpoints.LoadDashboard }}</div>
      <div>查询接口：{{ api.endpoints.ExecuteQueries }}</div>
      <div>挂载状态：{{ ready ? '已挂载' : '挂载中' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button } from '@grafana-fast/component';
  import { useDashboardSdk, DashboardApi } from '@grafana-fast/hooks';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const { state, actions, containerSize, api, ready, mountDashboard, unmountDashboard } = useDashboardSdk(dashboardRef, {
    dashboardId: 'default',
    apiConfig: {
      dsn: 'https://api.example.com',
      endpoints: {
        [DashboardApi.ExecuteQueries]: '/custom/execute',
      },
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

    &__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8f9fb;
      border: 1px solid #e3e6ed;
      border-radius: 8px;
      color: #1f2937;
      font-size: 13px;
    }

    &__status {
      display: flex;
      gap: 12px;
      color: #4b5563;
    }

    &__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    &__debug {
      margin-top: 10px;
      padding: 12px;
      background: #f6f9ff;
      border: 1px solid #d8e5f5;
      border-radius: 8px;
      color: #42516b;
      font-size: 12px;
      display: grid;
      gap: 6px;
    }

    &__canvas {
      flex: 1;
      min-height: 480px;
      border: 1px solid #e3e6ed;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
  }
</style>
