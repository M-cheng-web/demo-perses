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

      <div v-if="state.dashboard" class="dp-dashboard-view__stats">
        <Tag size="small" color="var(--gf-color-primary)">面板组 {{ state.dashboard.groupCount }}</Tag>
        <Tag size="small" variant="neutral">dashboardId: {{ state.dashboard.id ?? '-' }}</Tag>
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

      <div v-if="state.dashboard" class="dp-dashboard-view__command-grid">
        <div class="dp-dashboard-view__group">
          <div class="dp-dashboard-view__group-title">Dashboard</div>
          <div class="dp-dashboard-view__group-actions">
            <Button size="small" type="primary" @click="reloadDashboard">重新加载</Button>
            <Button size="small" type="ghost" @click="handleRefresh">刷新时间范围</Button>
            <Button size="small" type="ghost" @click="setQuickRange">最近 5 分钟</Button>
            <Button size="small" type="ghost" @click="toggleReadOnly">{{ state.readOnly ? '切换为可编辑' : '切换为只读' }}</Button>
          </div>
        </div>

        <div class="dp-dashboard-view__group">
          <div class="dp-dashboard-view__group-title">Debug</div>
          <div class="dp-dashboard-view__group-actions">
            <Button size="small" type="ghost" @click="debugOpen = true">调试信息</Button>
          </div>
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
    createMockApiClient: async () => (await import('@grafana-fast/api')).createMockApiClient(),
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
  const mockBusinessFetchDashboardId = async (): Promise<string> => {
    // 模拟网络延迟
    await new Promise<void>((r) => window.setTimeout(r, 600));
    // 这里返回一个稳定值，避免每次刷新都是“全新 dashboard”影响演示
    return 'biz-dashboard-001';
  };

  const resolveAndLoadDashboard = async () => {
    if (isResolvingDashboardId.value) return;
    isResolvingDashboardId.value = true;
    try {
      const id = await mockBusinessFetchDashboardId();
      resolvedDashboardId.value = id;
      await dashboardActions.loadDashboard(id);
    } finally {
      isResolvingDashboardId.value = false;
    }
  };

  onMounted(() => {
    void resolveAndLoadDashboard();
  });

  const reloadDashboard = async () => {
    try {
      if (resolvedDashboardId.value) {
        await dashboardActions.loadDashboard(resolvedDashboardId.value);
      } else {
        await resolveAndLoadDashboard();
      }
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
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--gf-space-3);
    padding: var(--gf-space-3);

    &__header {
      position: sticky;
      top: var(--gf-space-3);
      z-index: 20;
      padding: 14px 16px;
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
      gap: 12px;
      flex-wrap: wrap;
    }

    &__title {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    &__h1 {
      font-size: 18px;
      line-height: 1.15;
      font-weight: 820;
      letter-spacing: 0.2px;
    }

    &__sub {
      font-size: 12px;
      line-height: 1.45;
      color: var(--gf-color-text-tertiary);
      max-width: 640px;
    }

    &__nav {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    &__stats {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 10px;
      margin-top: 10px;
      border-top: 1px solid var(--gf-color-border-muted);
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

    &__command-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    &__group {
      padding: 10px;
      border-radius: var(--gf-radius-md);
      border: 1px solid var(--gf-color-border-muted);
      background: var(--gf-color-surface);
      transition:
        border-color var(--gf-motion-normal) var(--gf-easing),
        box-shadow var(--gf-motion-normal) var(--gf-easing);
    }

    &__group:hover {
      border-color: var(--gf-color-border-strong);
      box-shadow: 0 0 0 1px var(--gf-color-border-muted) inset;
    }

    &__group-title {
      font-size: 11px;
      font-weight: 760;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gf-color-text-tertiary);
      padding-bottom: 8px;
    }

    &__group-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &__canvas {
      // 固定测试台主画布高度：避免 dashboard 加载完成后 header 变高导致 canvas 被压缩（布局跳动）
      flex: 0 0 auto;
      height: clamp(520px, 72vh, 940px);
      min-height: 480px;
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
