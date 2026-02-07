/**
 * Pinia Attachments（把运行时依赖挂到 pinia 实例上）
 *
 * 背景：
 * - @grafana-fast/dashboard 的 store/composable 中有一些逻辑不在组件 setup 内执行
 * - 这类代码无法依赖 Vue 的 provide/inject（因为不一定有组件上下文）
 *
 * 方案：
 * - 把 apiClient / queryScheduler 等运行时依赖挂到 pinia 实例上
 * - 在组件树内依旧可以使用 inject（keys.ts），两者保持一致
 *
 * 多实例要求：
 * - 同一页面多个 dashboard 时，每个 dashboard 应绑定自己的 pinia（或显式传 pinia）
 * - getActivePinia 已做“组件内优先 injected pinia”的改造，避免串实例
 */
import { getActivePinia, type Pinia } from '@grafana-fast/store';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import { effectScope, type EffectScope } from 'vue';
import { createQueryScheduler } from '/#/query/queryScheduler';

const API_FIELD = '__gfApiClient';
const QUERY_SCHEDULER_FIELD = '__gfQueryScheduler';
const QUERY_SCHEDULER_SCOPE_FIELD = '__gfQuerySchedulerScope';

interface PiniaRuntimeAttachments extends Pinia {
  [API_FIELD]?: GrafanaFastApiClient;
  [QUERY_SCHEDULER_FIELD]?: ReturnType<typeof createQueryScheduler>;
  [QUERY_SCHEDULER_SCOPE_FIELD]?: EffectScope;
}

const withAttachments = (pinia: Pinia): PiniaRuntimeAttachments => pinia as PiniaRuntimeAttachments;

const resolvePinia = (pinia?: Pinia): Pinia | undefined => {
  return pinia ?? (getActivePinia() as unknown as Pinia | undefined);
};

/**
 * 绑定 apiClient 到 pinia（给 store/调度器等非组件代码使用）
 */
export function setPiniaApiClient(pinia: Pinia, api: GrafanaFastApiClient) {
  withAttachments(pinia)[API_FIELD] = api;
}

/**
 * 获取 pinia 上绑定的 apiClient
 *
 * 注意：
 * - 为了避免生产构建把 mock 实现/数据打进包里，这里不再提供默认 mock 兜底
 * - 宿主必须显式注入 apiClient（通过 useDashboardSdk({ apiClient }) 或 setPiniaApiClient(pinia, apiClient)）
 */
export function getPiniaApiClient(pinia?: Pinia): GrafanaFastApiClient {
  const p = resolvePinia(pinia);
  const api = p ? withAttachments(p)[API_FIELD] : undefined;
  if (api) return api;
  throw new Error('[grafana-fast] Missing apiClient. Provide it via useDashboardSdk({ apiClient }) or setPiniaApiClient(pinia, apiClient).');
}

/**
 * 获取（或创建）当前 pinia 对应的 QueryScheduler
 *
 * 说明：
 * - QueryScheduler 负责统一面板查询调度（timeRange/variable change -> refresh）
 * - 这里用 effectScope 包裹 scheduler 的内部 watch，确保 dispose 时可一次性停止
 */
export function getPiniaQueryScheduler(pinia?: Pinia) {
  const p = resolvePinia(pinia);
  if (!p) {
    throw new Error('[grafana-fast] Missing pinia instance. Ensure Dashboard is mounted via useDashboardSdk() or pass pinia explicitly.');
  }

  const attached = withAttachments(p);
  const existing = attached[QUERY_SCHEDULER_FIELD];
  if (existing) return existing;

  const scope: EffectScope = effectScope(true);
  const scheduler = scope.run(() => createQueryScheduler(p)) as ReturnType<typeof createQueryScheduler>;
  attached[QUERY_SCHEDULER_FIELD] = scheduler;
  attached[QUERY_SCHEDULER_SCOPE_FIELD] = scope;
  return scheduler;
}

/**
 * 获取调度器调试快照（只读，不会创建新的 scheduler 实例）
 */
export function getPiniaQuerySchedulerDebugSnapshot(pinia?: Pinia) {
  const p = resolvePinia(pinia);
  if (!p) return null;
  const scheduler = withAttachments(p)[QUERY_SCHEDULER_FIELD];
  return scheduler?.getDebugSnapshot?.() ?? null;
}

/**
 * 释放 pinia 上的 QueryScheduler（多实例/卸载时防止后台定时刷新与 watch 泄漏）
 */
export function disposePiniaQueryScheduler(pinia: Pinia) {
  const attached = withAttachments(pinia);
  const scope = attached[QUERY_SCHEDULER_SCOPE_FIELD];
  scope?.stop();
  delete attached[QUERY_SCHEDULER_FIELD];
  delete attached[QUERY_SCHEDULER_SCOPE_FIELD];
}
