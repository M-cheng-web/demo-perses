import { computed, ref, type ComputedRef, type Ref } from 'vue';

export type LoadMoreSource = 'auto' | 'manual';

export interface UseNearBottomAutoLoadOptions {
  enabled: Ref<boolean> | ComputedRef<boolean>;
  idleMs: Ref<number> | ComputedRef<number>;
  hasMore: Ref<boolean> | ComputedRef<boolean>;
  isBusy: Ref<boolean> | ComputedRef<boolean>;
  onLoadMore: (source: LoadMoreSource) => Promise<void>;
}

export function useNearBottomAutoLoad(options: UseNearBottomAutoLoadOptions) {
  const isNearBottom = ref(false);
  const hasUserInteracted = ref(false);
  const loadingMorePending = ref(false);
  const autoLoadLocked = ref(false);

  const delayMs = computed(() => Math.max(0, Math.floor(options.idleMs.value ?? 0)));

  let loadMoreTimer: number | null = null;

  const clearPending = () => {
    if (loadMoreTimer != null) {
      window.clearTimeout(loadMoreTimer);
      loadMoreTimer = null;
    }
    loadingMorePending.value = false;
  };

  const reset = () => {
    clearPending();
    isNearBottom.value = false;
    hasUserInteracted.value = false;
    autoLoadLocked.value = false;
  };

  const setUserInteracted = () => {
    hasUserInteracted.value = true;
    if (isNearBottom.value) scheduleAutoLoadIfNeeded();
  };

  const scheduleAutoLoadIfNeeded = () => {
    if (!options.enabled.value) return;
    if (!hasUserInteracted.value) return;
    if (!isNearBottom.value) return;
    if (!options.hasMore.value) return;
    if (options.isBusy.value) return;

    if (autoLoadLocked.value) return;

    if (loadMoreTimer != null) return;
    loadingMorePending.value = true;

    loadMoreTimer = window.setTimeout(async () => {
      loadMoreTimer = null;
      loadingMorePending.value = false;

      if (!options.enabled.value) return;
      if (!isNearBottom.value) return;
      if (!options.hasMore.value) return;
      if (options.isBusy.value) return;

      try {
        // 关键：同一次触底（nearBottom=true 的持续阶段）只允许自动触发一次
        autoLoadLocked.value = true;
        await options.onLoadMore('auto');
      } catch {
        // noop: 失败时避免 unhandled rejection；用户可通过“加载更多”按钮重试
      }
    }, delayMs.value);
  };

  const setNearBottom = (next: boolean) => {
    isNearBottom.value = next;

    if (!next) {
      clearPending();
      // 离开底部阈值后再解除 lock，确保一次触底不会连续触发多页
      // busy 中可能存在“内容高度变化导致 nearBottom 短暂 false”的闪动，避免在 busy 期间解锁
      if (!options.isBusy.value) autoLoadLocked.value = false;
      return;
    }

    scheduleAutoLoadIfNeeded();
  };

  const loadMoreManual = async () => {
    // 手动触发：同样视为“本次触底 session 已消费”，避免紧接着又被自动触发第二页
    setUserInteracted();
    autoLoadLocked.value = true;
    clearPending();
    await options.onLoadMore('manual');
  };

  return {
    isNearBottom,
    hasUserInteracted,
    loadingMorePending,
    reset,
    setUserInteracted,
    setNearBottom,
    scheduleAutoLoadIfNeeded,
    loadMoreManual,
  };
}
