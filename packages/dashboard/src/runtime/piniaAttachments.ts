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
import { createMockApiClient, type GrafanaFastApiClient } from '@grafana-fast/api';
import { effectScope, type EffectScope } from 'vue';
import { createQueryScheduler } from '/#/query/queryScheduler';

const API_FIELD = '__gfApiClient';
const QUERY_SCHEDULER_FIELD = '__gfQueryScheduler';
const QUERY_SCHEDULER_SCOPE_FIELD = '__gfQuerySchedulerScope';

/**
 * 绑定 apiClient 到 pinia（给 store/调度器等非组件代码使用）
 */
export function setPiniaApiClient(pinia: Pinia, api: GrafanaFastApiClient) {
  (pinia as any)[API_FIELD] = api;
}

/**
 * 获取 pinia 上绑定的 apiClient（若不存在则回退到 mock）
 *
 * 注意：
 * - 这个方法是“运行时兜底”，避免调用方因依赖缺失而直接崩溃
 * - 对多实例页面，推荐显式传入 pinia 或确保组件树正确注入 pinia
 */
export function getPiniaApiClient(pinia?: Pinia): GrafanaFastApiClient {
  const p = pinia ?? (getActivePinia() as any as Pinia | undefined);
  const api = p ? ((p as any)[API_FIELD] as GrafanaFastApiClient | undefined) : undefined;
  return api ?? createMockApiClient();
}

/**
 * 获取（或创建）当前 pinia 对应的 QueryScheduler
 *
 * 说明：
 * - QueryScheduler 负责统一面板查询调度（timeRange/variable change -> refresh）
 * - 这里用 effectScope 包裹 scheduler 的内部 watch，确保 dispose 时可一次性停止
 */
export function getPiniaQueryScheduler(pinia?: Pinia) {
  const p = pinia ?? (getActivePinia() as any as Pinia | undefined);
  if (!p) {
    // Fallback: create an unscoped scheduler. Prefer passing pinia.
    return createQueryScheduler(undefined as any);
  }

  const existing = (p as any)[QUERY_SCHEDULER_FIELD] as ReturnType<typeof createQueryScheduler> | undefined;
  if (existing) return existing;

  const scope: EffectScope = effectScope(true);
  const scheduler = scope.run(() => createQueryScheduler(p)) as ReturnType<typeof createQueryScheduler>;
  (p as any)[QUERY_SCHEDULER_FIELD] = scheduler;
  (p as any)[QUERY_SCHEDULER_SCOPE_FIELD] = scope;
  return scheduler;
}

/**
 * 释放 pinia 上的 QueryScheduler（多实例/卸载时防止后台定时刷新与 watch 泄漏）
 */
export function disposePiniaQueryScheduler(pinia: Pinia) {
  const scope = (pinia as any)[QUERY_SCHEDULER_SCOPE_FIELD] as EffectScope | undefined;
  scope?.stop();
  delete (pinia as any)[QUERY_SCHEDULER_FIELD];
  delete (pinia as any)[QUERY_SCHEDULER_SCOPE_FIELD];
}
