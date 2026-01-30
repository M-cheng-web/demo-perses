<!--
  文件说明：演示站点 - Dashboard 入口页

  作用：
  - 作为回归验证平台，集成 useDashboardSdk + apiClient（默认 mock）
  - 提供调试信息面板（容器尺寸/当前 endpoint 等）
-->
<template>
  <div class="dp-dashboard-view">
    <div v-if="state.dashboard" class="dp-dashboard-view__meta">
      <div class="dp-dashboard-view__status">
        <span>面板组: {{ state.panelGroups.length }}</span>
      </div>
      <div class="dp-dashboard-view__actions">
        <Segmented v-model:value="themeModel" :options="themeOptions" />
        <Button type="primary" @click="goComponents">组件库</Button>
        <Button type="ghost" @click="goJsonEditor">JSON Editor 测试</Button>
        <Button type="ghost" @click="goPromql">PromQL 测试</Button>
        <Button type="ghost" @click="goPerf">性能压测</Button>
        <Button type="ghost" @click="reloadDashboard">重新加载</Button>
        <Button type="ghost" @click="setQuickRange">最近 5 分钟</Button>
        <Button type="ghost" @click="actions.openSettings">打开设置侧边栏</Button>
        <Button type="ghost" @click="actions.toggleSettings">切换设置侧边栏</Button>
        <Button type="ghost" @click="actions.toolbar.viewJson">Toolbar: 查看 JSON</Button>
        <Button type="ghost" @click="actions.toolbar.exportJson">Toolbar: 导出 JSON</Button>
        <Button type="ghost" @click="actions.toolbar.importJson">Toolbar: 导入 JSON</Button>
        <Button type="ghost" @click="actions.toolbar.refresh">Toolbar: 刷新</Button>
        <Button type="ghost" @click="() => actions.toolbar.setTimeRangePreset('now-5m')">Toolbar: 最近 5 分钟</Button>
        <Button type="ghost" @click="actions.toolbar.togglePanelsView">Toolbar: 切换视图</Button>
        <Button type="ghost" @click="handleRefresh">刷新时间范围</Button>
        <Button type="ghost" @click="schedulerOpen = true">调度器监控</Button>
        <Button type="ghost" @click="mountDashboard">挂载</Button>
        <Button type="ghost" @click="unmountDashboard">卸载</Button>
        <Button type="ghost" @click="debugOpen = true">调试信息</Button>
      </div>
    </div>

    <div class="dp-dashboard-view__canvas" ref="dashboardRef"></div>

    <Modal v-model:open="debugOpen" title="调试信息" :width="560" @cancel="debugOpen = false">
      <List :items="debugItems" variant="lines" :split="false" />
    </Modal>

    <Modal v-model:open="schedulerOpen" title="调度器监控（可视优先刷新）" :width="720" @cancel="schedulerOpen = false">
      <div class="dp-dashboard-view__scheduler-actions">
        <Button type="ghost" @click="refreshVisibleNow">刷新可视区域</Button>
        <Button type="ghost" @click="clearQueryCacheNow">清空查询缓存</Button>
      </div>
      <List :items="schedulerItems" variant="lines" :split="false" />
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, List, Modal, Segmented } from '@grafana-fast/component';
  import { useDashboardSdk, DashboardApi } from '@grafana-fast/hooks';
  import type { DashboardTheme } from '@grafana-fast/dashboard';
  import { getPiniaQueryScheduler } from '@grafana-fast/dashboard';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const debugOpen = ref(false);
  const schedulerOpen = ref(false);
  const { pinia, state, actions, containerSize, api, ready, mountDashboard, unmountDashboard, theme } = useDashboardSdk(dashboardRef, {
    dashboardId: 'default',
    apiConfig: {
      baseUrl: 'https://api.example.com',
      endpoints: {
        [DashboardApi.ExecuteQueries]: '/custom/execute',
      },
    },
  });

  const scheduler = computed(() => getPiniaQueryScheduler(pinia));

  const debugItems = computed(() => [
    { key: 'size', label: '容器尺寸', value: `${containerSize.value.width} × ${containerSize.value.height}` },
    { key: 'baseUrl', label: '当前 BaseUrl', value: api.value.baseUrl },
    { key: 'load', label: '加载接口', value: api.value.endpoints[DashboardApi.LoadDashboard] },
    { key: 'query', label: '查询接口', value: api.value.endpoints[DashboardApi.ExecuteQueries] },
    { key: 'ready', label: '挂载状态', value: ready.value ? '已挂载' : '挂载中' },
    { key: 'theme', label: '主题', value: theme.value },
  ]);

  const schedulerItems = computed(() => {
    const debugRef = (scheduler.value as any).debug;
    const snap = debugRef?.value ?? ((scheduler.value as any).getDebugSnapshot ? (scheduler.value as any).getDebugSnapshot() : null);
    const top = (snap?.topPending ?? []) as Array<{ panelId: string; priority: number; reason: string; ageMs: number }>;
    return [
      { key: 'visiblePanels', label: '可视 panels（viewport + 0.5 屏）', value: String(snap?.visiblePanels ?? '-') },
      { key: 'registeredPanels', label: '已注册 panels', value: String(snap?.registeredPanels ?? '-') },
      { key: 'pendingTasks', label: '待执行任务', value: String(snap?.pendingTasks ?? '-') },
      { key: 'inflight', label: '执行中 panels', value: String(snap?.inflightPanels ?? '-') },
      { key: 'maxPanelConcurrency', label: '面板并发上限', value: String(snap?.maxPanelConcurrency ?? '-') },
      { key: 'conditionGeneration', label: '全局条件代际（time/var）', value: String(snap?.conditionGeneration ?? '-') },
      { key: 'queueGeneration', label: '队列代际（取消/切换）', value: String(snap?.queueGeneration ?? '-') },
      {
        key: 'topPending',
        label: '队列头部（最多 12 条）',
        value: top.length ? top.map((t) => `${t.panelId} | p=${t.priority} | ${t.reason} | ${Math.round(t.ageMs)}ms`).join('\n') : '(空)',
      },
    ];
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

  const reloadDashboard = async () => {
    try {
      await actions.loadDashboard('default');
    } catch {
      // demo page: errors are surfaced via console / onError hook in host apps
    }
  };
  const handleRefresh = () => actions.refreshTimeRange();
  const refreshVisibleNow = () => (scheduler.value as any).refreshVisible?.();
  const clearQueryCacheNow = () => (scheduler.value as any).invalidateAll?.();
  const setQuickRange = () =>
    actions.setTimeRange({
      from: 'now-5m',
      to: 'now',
    });

  const goComponents = () => router.push('/components');
  const goPerf = () => router.push('/perf');
  const goJsonEditor = () => router.push('/json-editor');
  const goPromql = () => router.push('/promql');
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
      align-items: center;
      flex-wrap: wrap;
    }

    &__scheduler-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding-bottom: 8px;
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
