<!--
  文件说明：DashboardView（对外导出组件 - SDK Only）

  约束：
  - 当前仓库不再支持“直接挂载 DashboardView 组件”的集成方式。
  - 只能通过 `@grafana-fast/hooks` 的 `useDashboardSdk(ref, options)` 来挂载。

  行为：
  - 若检测到非 SDK 挂载：给出 console.warn，并渲染一个错误提示（禁止加载）。
  - 若为 SDK 挂载：渲染真实的 Dashboard 核心组件（Dashboard.vue）。
-->
<template>
  <DashboardCore
    v-if="isSdkMount"
    :theme="props.theme"
    :portal-target="props.portalTarget"
    :api-client="props.apiClient"
    :instance-id="props.instanceId"
    :panel-group-focus-motion-ms="props.panelGroupFocusMotionMs"
  />

  <div v-else class="dp-dashboard-sdk-only">
    <Alert
      type="error"
      show-icon
      message="不支持直接使用 DashboardView"
      description="请使用 @grafana-fast/hooks 的 useDashboardSdk(ref, options) 挂载（SDK 会负责 pinia 隔离、mount/unmount 与对外控制）。"
    />
  </div>
</template>

<script setup lang="ts">
  import { inject } from 'vue';
  import type { Pinia } from '@grafana-fast/store';
  import type { GrafanaFastApiClient } from '@grafana-fast/api';
  import { Alert } from '@grafana-fast/component';
  import DashboardCore from './Dashboard.vue';

  defineOptions({
    name: 'DashboardView',
  });

  const props = withDefaults(
    defineProps<{
      theme?: 'light' | 'dark';
      portalTarget?: string | HTMLElement | null;
      apiClient?: GrafanaFastApiClient;
      instanceId: string;
      panelGroupFocusMotionMs?: number;
    }>(),
    {
      theme: 'light',
      portalTarget: null,
      apiClient: undefined,
      panelGroupFocusMotionMs: 200,
    }
  );

  const injectedPinia = inject<Pinia | undefined>('pinia', undefined);
  const isSdkMount = Boolean(injectedPinia && (injectedPinia as any).__gfDashboardSdkMount === true);

  let warned = (globalThis as any).__gfDashboardDirectMountWarned === true;
  if (!isSdkMount && !warned) {
    warned = true;
    (globalThis as any).__gfDashboardDirectMountWarned = true;
    console.warn(
      [
        '[grafana-fast] DashboardView direct mount is disabled.',
        'Please use `@grafana-fast/hooks` -> `useDashboardSdk(ref, options)` to mount dashboards.',
      ].join(' ')
    );
  }
</script>

<style scoped lang="less">
  .dp-dashboard-sdk-only {
    width: 100%;
    height: 100%;
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
</style>

