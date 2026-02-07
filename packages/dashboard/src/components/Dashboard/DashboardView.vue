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
    :api-mode="props.apiMode"
    :api-mode-options="props.apiModeOptions"
    :api-mode-switching="props.apiModeSwitching"
    :on-request-api-mode-change="props.onRequestApiModeChange"
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

  interface SdkMountPinia extends Pinia {
    __gfDashboardSdkMount?: true;
  }

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
      /**
       * （可选）API 模式：remote/mock
       * - 由 SDK/宿主决定是否开启（用于本地开发/演示切换）
       */
      apiMode?: 'remote' | 'mock';
      /**
       * （可选）API 模式可选项
       * - 未提供则 Dashboard 的全局设置中不会出现“数据源模式”卡片
       */
      apiModeOptions?: Array<{ label: string; value: 'remote' | 'mock'; disabled?: boolean }>;
      /** 切换中：禁用控件，避免重复触发 */
      apiModeSwitching?: boolean;
      /**
       * （可选）请求切换 API 模式
       * - 由 SDK/宿主实现（通常会重绑 apiClient 并触发 remount）
       */
      onRequestApiModeChange?: (mode: 'remote' | 'mock') => void | Promise<void>;
    }>(),
    {
      theme: 'light',
      portalTarget: null,
      panelGroupFocusMotionMs: 200,
      apiModeSwitching: false,
    }
  );

  const injectedPinia = inject<Pinia | undefined>('pinia', undefined);
  const sdkPinia = injectedPinia as SdkMountPinia | undefined;
  const isSdkMount = Boolean(sdkPinia?.__gfDashboardSdkMount === true);

  const globalScope = globalThis as typeof globalThis & { __gfDashboardDirectMountWarned?: boolean };
  let warned = globalScope.__gfDashboardDirectMountWarned === true;
  if (!isSdkMount && !warned) {
    warned = true;
    globalScope.__gfDashboardDirectMountWarned = true;
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
