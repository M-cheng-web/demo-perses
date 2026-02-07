import { computed, type ComputedRef, type Ref } from 'vue';
import type { PanelLoadingKind, PanelQueryPhase } from '/#/query/queryScheduler';

interface UsePanelQueryViewStateOptions {
  hasVisibleQueries: ComputedRef<boolean>;
  hasChartComponent: ComputedRef<boolean>;
  phase: Ref<PanelQueryPhase>;
  loadingKind: Ref<PanelLoadingKind>;
  hasSnapshot: Ref<boolean>;
}

/**
 * 把 panel 查询相关的“视图展示判定”集中到一处，避免模板层分散判断。
 */
export function usePanelQueryViewState(options: UsePanelQueryViewStateOptions) {
  const isRequesting = computed(() => options.phase.value === 'queued' || options.phase.value === 'loading');

  const showBlockingLoading = computed(() => {
    if (!options.hasVisibleQueries.value || !options.hasChartComponent.value) return false;
    if (options.phase.value === 'waiting' && !options.hasSnapshot.value) return true;
    return isRequesting.value && options.loadingKind.value === 'blocking';
  });

  const showRefreshing = computed(() => {
    if (!options.hasVisibleQueries.value || !options.hasChartComponent.value) return false;
    return isRequesting.value && options.loadingKind.value === 'refreshing';
  });

  return {
    showBlockingLoading,
    showRefreshing,
  };
}
