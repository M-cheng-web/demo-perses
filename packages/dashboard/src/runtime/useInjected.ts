/**
 * useInjected（运行时依赖获取）
 *
 * 说明：
 * - 组件树内部优先使用 Vue 的 provide/inject 获取运行时依赖
 * - 这里提供了安全兜底：如果宿主没有 provide，会回退到默认 mock/内置 registry
 *
 * 注意：
 * - store/composable 中如果不在组件上下文执行，则应使用 piniaAttachments 获取（见 piniaAttachments.ts）
 */
import { inject } from 'vue';
import { createMockApiClient, type GrafanaFastApiClient } from '@grafana-fast/api';
import { GF_API_KEY, GF_RUNTIME_KEY, type DashboardRuntimeContext } from './keys';

/**
 * 获取当前运行时 API Client
 * - 默认回退到 mock 实现（便于 demo/离线）
 */
export function useApiClient(): GrafanaFastApiClient {
  return inject(GF_API_KEY, createMockApiClient());
}

/**
 * 获取当前 Dashboard 运行时上下文（多实例隔离用）
 */
export function useDashboardRuntime(): DashboardRuntimeContext {
  return inject(GF_RUNTIME_KEY, { id: 'default' });
}
