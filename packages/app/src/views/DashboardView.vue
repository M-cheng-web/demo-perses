<!--
  文件说明：演示站点 - Dashboard 入口页

  作用：
  - 作为回归验证平台，集成 useDashboardSdk + apiClient（默认 mock）
  - 提供调试信息面板（容器尺寸/当前 endpoint 等）
-->
<template>
  <div class="dp-dashboard-view">
    <div class="dp-dashboard-view__header">
      <div class="dp-dashboard-view__headline">
        <div class="dp-dashboard-view__title">
          <div class="dp-dashboard-view__h1">Dashboard 测试台</div>
          <div class="dp-dashboard-view__sub">本页仅用于本地回归：SDK / Toolbar / 弹窗 / 性能等能力验证（非生产 UI）。</div>
        </div>

        <div class="dp-dashboard-view__nav">
          <Segmented v-model:value="themeModel" size="small" :options="themeOptions" />
          <Button size="small" type="primary" @click="goComponents">组件库</Button>
          <Button size="small" type="ghost" @click="goJsonEditor">JSON Editor</Button>
          <Button size="small" type="ghost" @click="goPromql">PromQL</Button>
          <Button size="small" type="ghost" @click="goPerf">性能</Button>
        </div>
      </div>

      <div class="dp-dashboard-view__controls">
        <div class="dp-dashboard-view__status-group" :class="{ 'is-placeholder': !state.dashboard }">
          <Tag size="small" color="var(--gf-color-primary)">面板组 {{ state.dashboard?.groupCount ?? '-' }}</Tag>
          <Tag size="small" variant="neutral">dashboardId: {{ state.dashboard?.id ?? '-' }}</Tag>
          <Tag size="small" :color="state.mounted ? 'var(--gf-color-success)' : 'var(--gf-color-warning)'">
            {{ state.mounted ? '已挂载' : '未挂载' }}
          </Tag>
          <Tag size="small" :color="state.ready ? 'var(--gf-color-success)' : 'var(--gf-color-warning)'">
            {{ state.ready ? 'Ready' : 'Not Ready' }}
          </Tag>
          <Tag size="small" variant="neutral">Theme: {{ themeModel }}</Tag>
          <Tag size="small" variant="neutral">Boot: {{ state.bootStage }}</Tag>
          <Tag size="small" variant="neutral">View: {{ state.viewMode }}</Tag>
          <Tag size="small" variant="neutral">容器: {{ state.containerSize.width }} × {{ state.containerSize.height }}</Tag>
        </div>

        <div class="dp-dashboard-view__action-group">
          <Button size="small" type="primary" @click="reloadDashboard">重新加载</Button>
          <Button size="small" type="ghost" :disabled="!resolvedDashboardId || isResolvingDashboardId" @click="toggleDashboardId">
            {{ switchDashboardButtonText }}
          </Button>
          <Button size="small" type="ghost" :disabled="!state.dashboard" @click="handleRefresh">刷新时间范围</Button>
          <Button size="small" type="ghost" :disabled="!state.dashboard" @click="setQuickRange">最近 5 分钟</Button>
          <Button size="small" type="ghost" :disabled="!state.dashboard" @click="toggleReadOnly">
            {{ state.readOnly ? '切换为可编辑' : '切换为只读' }}
          </Button>
          <Button size="small" type="ghost" @click="debugOpen = true">调试信息</Button>
        </div>
      </div>
    </div>

    <div class="dp-dashboard-view__canvas" ref="dashboardRef"></div>

    <Modal v-model:open="debugOpen" title="调试信息" :width="560" @cancel="debugOpen = false">
      <List :items="debugItems" variant="lines" :split="false" />
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button, List, Modal, Segmented, Tag } from '@grafana-fast/component';
  import { useDashboardSdk } from '@grafana-fast/hooks';
  import type { DashboardTheme } from '@grafana-fast/dashboard';

  const router = useRouter();
  const dashboardRef = ref<HTMLElement | null>(null);
  const debugOpen = ref(false);

  const {
    on,
    getState,
    actions: dashboardActions,
  } = useDashboardSdk(dashboardRef, {
    // 方案A演示：dashboardId（资源标识）可能来自宿主业务接口，因此这里禁用 autoLoad，
    // 等“宿主先拿到 dashboardId”后再显式调用 actions.loadDashboard(dashboardId)。
    autoLoad: false,
    enableMock: true,
    defaultApiMode: 'mock',
    createMockApiClient: async () => (await import('@grafana-fast/api/mock')).createMockApiClient(),
  });

  const state = ref(getState());
  on('change', (payload) => {
    state.value = payload.state;
  });

  const debugItems = computed(() => [
    { key: 'size', label: '容器尺寸', value: `${state.value.containerSize.width} × ${state.value.containerSize.height}` },
    { key: 'mounted', label: '挂载状态', value: state.value.mounted ? '已挂载' : '未挂载' },
    { key: 'ready', label: 'SDK Ready', value: state.value.ready ? '是' : '否' },
    { key: 'bootStage', label: 'Boot Stage', value: state.value.bootStage },
    { key: 'viewMode', label: 'View Mode', value: state.value.viewMode },
    { key: 'theme', label: '主题', value: state.value.theme },
    { key: 'readOnly', label: 'Read Only', value: state.value.readOnly ? 'true' : 'false' },
    { key: 'variablesRevision', label: 'Variables Rev', value: String(state.value.variablesRevision) },
    { key: 'dashboardRevision', label: 'Dashboard Rev', value: String(state.value.dashboardRevision) },
    { key: 'lastError', label: 'Last Error', value: state.value.lastError ?? '-' },
  ]);

  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ] as const;

  const themeModel = computed({
    get: () => state.value.theme,
    set: (value: DashboardTheme) => {
      dashboardActions.setTheme(value);
    },
  });

  // 模拟“宿主业务接口”获取 dashboardId（资源标识）的真实流程：
  // - 业务侧可能先请求 project/user/space 等上下文
  // - 再根据业务返回结果决定最终 dashboardId
  const resolvedDashboardId = ref<string | null>(null);
  const isResolvingDashboardId = ref(false);
  const EMPTY_DASHBOARD_ID = 'biz-dashboard-empty-001';
  const mockBusinessFetchDashboardId = async (): Promise<string> => {
    // 模拟网络延迟
    await new Promise<void>((r) => window.setTimeout(r, 600));
    // 这里返回一个稳定值，避免每次刷新都是“全新 dashboard”影响演示
    return 'biz-dashboard-001';
  };
  const mockBusinessFetchEmptyDashboardId = async (): Promise<string> => {
    await new Promise<void>((r) => window.setTimeout(r, 600));
    return EMPTY_DASHBOARD_ID;
  };

  const resolveAndLoadDashboard = async (mode: 'original' | 'empty' = 'original') => {
    if (isResolvingDashboardId.value) return;
    isResolvingDashboardId.value = true;
    try {
      // 类似浏览器刷新：先把 dashboard 状态重置到 waiting（显示“正在连接数据”），
      // 再模拟宿主业务接口获取 dashboardId（资源标识），最后加载 dashboard JSON。
      dashboardActions.resetDashboard();
      const id = mode === 'empty' ? await mockBusinessFetchEmptyDashboardId() : await mockBusinessFetchDashboardId();
      if (mode === 'original') resolvedDashboardId.value = id;
      await dashboardActions.loadDashboard(id);
    } finally {
      isResolvingDashboardId.value = false;
    }
  };

  onMounted(() => {
    void resolveAndLoadDashboard('original');
  });

  // Demo: dashboardId switching (should trigger full dashboard reload every time)
  const isEmptyDashboard = computed(() => state.value.dashboard?.id === EMPTY_DASHBOARD_ID);
  const switchDashboardButtonText = computed(() => (isEmptyDashboard.value ? '切换回原 dashboardId' : '切换到空 dashboardId'));
  const toggleDashboardId = async () => {
    if (isResolvingDashboardId.value) return;
    void resolveAndLoadDashboard(isEmptyDashboard.value ? 'original' : 'empty');
  };

  const reloadDashboard = async () => {
    try {
      await resolveAndLoadDashboard(isEmptyDashboard.value ? 'empty' : 'original');
    } catch {
      // demo page: errors are surfaced via console / onError hook in host apps
    }
  };
  const handleRefresh = () => dashboardActions.refreshTimeRange();
  const toggleReadOnly = () => dashboardActions.setReadOnly(!state.value.readOnly);
  const setQuickRange = () =>
    dashboardActions.setTimeRange({
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
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--gf-space-2);
    padding: var(--gf-space-2);

    &__header {
      position: sticky;
      top: var(--gf-space-2);
      z-index: 20;
      padding: 10px 12px;
      border-radius: var(--gf-radius-lg);
      border: 1px solid var(--gf-color-border);
      background: var(--gf-color-surface);
      box-shadow: none;
      transition:
        box-shadow var(--gf-motion-normal) var(--gf-easing),
        border-color var(--gf-motion-normal) var(--gf-easing);
    }

    &__header:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
    }

    &__headline {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    &__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    &__h1 {
      font-size: 17px;
      line-height: 1.15;
      font-weight: 820;
      letter-spacing: 0.2px;
    }

    &__sub {
      font-size: 11px;
      line-height: 1.45;
      color: var(--gf-color-text-tertiary);
      max-width: 560px;
    }

    &__nav {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    &__controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 8px;
      margin-top: 8px;
      border-top: 1px solid var(--gf-color-border-muted);
      flex-wrap: wrap;
    }

    &__status-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    &__action-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    &__status-group.is-placeholder {
      opacity: 0.8;
    }

    &__mono {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      padding: 2px 8px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface-muted);
      color: var(--gf-color-text-secondary);
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__canvas {
      // 画布占满测试台剩余空间；header 区域常驻后，加载前后高度不会跳动
      flex: 1 1 auto;
      height: auto;
      min-height: 0;
      border-radius: var(--gf-radius-lg);
      background: var(--gf-color-surface-muted);
      border: 1px solid var(--gf-color-border);
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
      box-shadow: none;
    }
  }
</style>
