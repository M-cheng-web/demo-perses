/**
 * useInjected（运行时依赖获取）
 *
 * 说明：
 * - 组件树内部优先使用 Vue 的 provide/inject 获取运行时依赖
 * - 运行时依赖（apiClient）应由宿主显式提供；不再默认回退到 mock
 *
 * 注意：
 * - store/composable 中如果不在组件上下文执行，则应使用 piniaAttachments 获取（见 piniaAttachments.ts）
 */
import { inject } from 'vue';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import { getPiniaApiClient } from './piniaAttachments';
import { GF_RUNTIME_KEY, type DashboardRuntimeContext } from './keys';

/**
 * 获取当前运行时 API Client
 */
export function useApiClient(): GrafanaFastApiClient {
  // Prefer pinia attachments so runtime switching (mock/remote) works without re-providing inject values.
  return getPiniaApiClient();
}

/**
 * 获取当前 Dashboard 运行时上下文（多实例隔离用）
 */
export function useDashboardRuntime(): DashboardRuntimeContext {
  return inject(GF_RUNTIME_KEY, { id: 'default' });
}
