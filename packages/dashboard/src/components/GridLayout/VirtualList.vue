<!--
  组件说明：分页 + 可视请求控制的虚拟列表容器（VirtualList）

  目标：
  - 避免一次性把 1000 条 panel layout 交给视图层（尤其是 vue-grid-layout 的布局计算）
  - 通过 query(offset/limit) 逐步加载 layout 子集（dataList）
  - 通过“停留 idleMs 后才上报可视集合”的策略，避免滚动期间触发 QueryScheduler 请求风暴
  - 通过 hydratedIds（不断层）确保已经“热过”的面板再次出现时可以直接渲染真实内容

  用法：
  - 组件不关心具体渲染结构，直接通过 slot 把 dataList/状态/方法暴露出去
  - slot 内部自行 v-for 渲染 grid-item / list-item
-->
<template>
  <div ref="containerRef" :class="bem()" :style="containerStyle">
    <div ref="contentRef" :class="bem('content')">
      <slot
        :data-list="dataList"
        :render-list="renderList"
        :loading="loading"
        :loading-more="loadingMore"
        :loading-more-pending="loadingMorePending"
        :has-more="hasMore"
        :load-more="loadMore"
        :reset="reset"
        :is-hot="isHot"
        :is-hydrated="isHydrated"
        :is-virtualizing="isVirtualizing"
        :is-scrolling="isScrolling"
        :total-count="totalCount"
      ></slot>

      <!-- 底部占位：用于触底加载 + 提供一个“可被观察的目标” -->
      <div ref="sentinelRef" :class="bem('sentinel')" :style="{ height: `${sentinelHeightPx}px` }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import type { PanelLayout } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';
  import { useNearBottomAutoLoad, type LoadMoreSource } from './useNearBottomAutoLoad';

  defineOptions({ name: 'VirtualList' });

  type PanelId = PanelLayout['i'];

  type QueryArgs = { offset: number; limit: number; viewportHeight?: number };
  type QueryResult = { items: PanelLayout[]; total?: number } | PanelLayout[];

  const props = withDefaults(
    defineProps<{
      /** scheduler 的可视范围 scope（建议传 groupId） */
      scopeId: string;
      /** 滚动容器来源：self=组件内部滚动；runtime=使用 Dashboard 外层滚动容器（默认） */
      scrollMode?: 'self' | 'runtime';
      /** 固定高度（例如 560 或 '560px'），组件内部自带滚动 */
      height?: number | string;
      /** 每次加载多少条 */
      pageSize?: number;
      /** 由外部提供的“分页查询”（可同步可异步） */
      query: (args: QueryArgs) => QueryResult | Promise<QueryResult>;
      /** 距离底部多少 px 触发 loadMore */
      thresholdPx?: number;
      /** 停止滚动多久后才允许触发真实请求 / loadMore */
      idleMs?: number;
      /** 是否启用（默认启用） */
      enabled?: boolean;
      /** 超过该数量才启用“停留后请求 / 窗口化渲染”策略（默认 10） */
      virtualizeThreshold?: number;
      /** 用于估算 grid-item 的 top/bottom（与 vue-grid-layout-v3 的 calcPosition 保持一致） */
      rowHeight?: number;
      /** 用于估算 grid-item 的 top/bottom（margin 的 y 值） */
      marginY?: number;
      /** hot 窗口的 overscan（单位：屏幕高度） */
      hotOverscanScreens?: number;
      /** 用于外部数据变更时强制 reset（例如 layout / groupId 变化） */
      resetKey?: string | number;
    }>(),
    {
      scrollMode: 'runtime',
      height: 560,
      pageSize: 50,
      thresholdPx: 200,
      idleMs: 200,
      enabled: true,
      virtualizeThreshold: 10,
      rowHeight: 30,
      marginY: 10,
      hotOverscanScreens: 0.25,
      resetKey: undefined,
    }
  );

  const [_, bem] = createNamespace('virtual-list');
  const scheduler = getPiniaQueryScheduler();
  const runtime = useDashboardRuntime();

  const containerRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const sentinelRef = ref<HTMLElement | null>(null);

  const DEFAULT_SELF_HEIGHT_PX = 560;

  const runtimeScrollEl = computed(() => runtime.scrollEl?.value ?? null);
  const resolvedScrollEl = computed(() => {
    if (props.scrollMode === 'runtime') return runtimeScrollEl.value ?? containerRef.value;
    return containerRef.value;
  });

  const containerStyle = computed(() => {
    if (props.scrollMode === 'self') {
      const height = props.height ?? DEFAULT_SELF_HEIGHT_PX;
      const heightCss = typeof height === 'number' ? `${height}px` : height;
      return {
        height: heightCss,
        overflow: 'auto',
        width: '100%',
        minHeight: 0,
      };
    }
    // runtime scroll：容器自身不滚动（跟随外层 Dashboard contentEl）
    return {
      width: '100%',
      minHeight: 0,
    };
  });

  // sentinel 用于触底判定，不需要太高（过高会导致底部 UI 看起来“离底部有空隙”）
  const sentinelHeightPx = computed(() => 8);

  const dataList = ref<PanelLayout[]>([]);
  const totalCount = ref(0);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const isBusy = computed(() => loading.value || loadingMore.value);

  const autoLoad = useNearBottomAutoLoad({
    enabled: computed(() => Boolean(props.enabled)),
    idleMs: computed(() => Math.max(0, Math.floor(props.idleMs ?? 0))),
    hasMore,
    isBusy,
    onLoadMore: doLoadMore,
  });

  const loadingMorePending = autoLoad.loadingMorePending;
  const isNearBottom = autoLoad.isNearBottom;

  const threshold = computed(() => Math.max(0, props.virtualizeThreshold ?? 0));
  const virtualizeWanted = computed(() => {
    if (!props.enabled) return false;
    return totalCount.value > threshold.value;
  });

  const isVirtualizing = computed(() => virtualizeWanted.value);

  const normalizeId = (id: PanelId): string => String(id);
  const normalizeQueryResult = (res: QueryResult | undefined | null): { items: PanelLayout[]; total?: number } => {
    if (!res) return { items: [] };
    if (Array.isArray(res)) return { items: res };
    return { items: res.items ?? [], total: res.total };
  };

  // 用于取消/屏蔽过期请求（reset 期间）
  let queryGeneration = 0;

  const applyQueryResult = (items: PanelLayout[], total?: number, lastPageLength?: number) => {
    dataList.value = items;
    if (typeof total === 'number' && Number.isFinite(total)) {
      totalCount.value = Math.max(0, Math.floor(total));
      hasMore.value = dataList.value.length < totalCount.value;
      return;
    }
    totalCount.value = dataList.value.length;
    // 没有 total 时只能用“是否拿满 pageSize”来猜测
    const pageLen = typeof lastPageLength === 'number' ? lastPageLength : items.length;
    hasMore.value = pageLen >= Math.max(1, props.pageSize ?? 0);
  };

  const reset = async () => {
    queryGeneration++;
    const gen = queryGeneration;

    loading.value = true;
    loadingMore.value = false;
    hasMore.value = true;
    totalCount.value = 0;
    dataList.value = [];
    autoLoad.reset();
    lastScrollTopForIntent = resolvedScrollEl.value?.scrollTop ?? 0;

    // reset virtualization state
    hotIds.value = new Set();
    hydratedIds.value = new Set();
    isScrolling.value = false;
    visibilityGeneration++;
    scheduler.setVisiblePanels?.(props.scopeId, []);

    // reset scroll position
    if (props.scrollMode === 'self') {
      suppressScrollIntentForTwoFrames();
      resolvedScrollEl.value?.scrollTo?.({ top: 0 });
    }

    try {
      const limit = Math.max(1, props.pageSize ?? 1);
      const viewportHeight = resolvedScrollEl.value?.clientHeight ?? DEFAULT_SELF_HEIGHT_PX;
      const res = await Promise.resolve(props.query({ offset: 0, limit, viewportHeight }));
      if (gen !== queryGeneration) return;
      const { items, total } = normalizeQueryResult(res);
      applyQueryResult(items, total, items.length);
    } finally {
      if (gen === queryGeneration) loading.value = false;
    }

    await nextTick();
    scheduleViewportUpdate();
    void applyHotVisible();
  };

  async function doLoadMore(_source: LoadMoreSource) {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    if (!props.enabled) return;

    const scroller = resolvedScrollEl.value;
    // 如果用户触发 loadMore 时就在底部附近，则在内容追加后自动“跟随到底部”，避免 loading/按钮位置跳走
    updateViewport();
    const shouldStickToBottom = Boolean(scroller) && isNearBottom.value;

    const offset = dataList.value.length;
    loadingMorePending.value = false;
    loadingMore.value = true;
    const gen = queryGeneration;
    try {
      const limit = Math.max(1, props.pageSize ?? 1);
      const viewportHeight = resolvedScrollEl.value?.clientHeight ?? DEFAULT_SELF_HEIGHT_PX;
      const res = await Promise.resolve(props.query({ offset, limit, viewportHeight }));
      if (gen !== queryGeneration) return;

      const { items, total } = normalizeQueryResult(res);
      if (!items.length) {
        // 兜底：避免空页导致无限触发
        hasMore.value = false;
        if (typeof total === 'number') totalCount.value = total;
      } else {
        const next = [...dataList.value, ...items];
        applyQueryResult(next, typeof total === 'number' ? total : undefined, items.length);
      }

      await nextTick();
      if (shouldStickToBottom) {
        const sentinel = sentinelRef.value;
        if (sentinel) {
          suppressScrollIntentForTwoFrames();
          sentinel.scrollIntoView?.({ block: 'end' });
          // grid-layout 的高度更新可能在同一帧/下一帧完成，二次对齐保证 “loading 始终贴底”
          window.requestAnimationFrame(() => {
            sentinelRef.value?.scrollIntoView?.({ block: 'end' });
          });
        }
      }
      scheduleViewportUpdate();
      void applyHotVisible();
    } finally {
      if (gen === queryGeneration) loadingMore.value = false;
    }
  }

  const loadMore = async () => {
    await autoLoad.loadMoreManual();
  };

  // ---------------------------
  // 触底加载：near-bottom + idle gating
  // ---------------------------
  let lastScrollTopForIntent = 0;
  let suppressScrollIntent = false;

  const suppressScrollIntentForTwoFrames = () => {
    suppressScrollIntent = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        suppressScrollIntent = false;
      });
    });
  };

  // ---------------------------
  // 可视窗口 + idle 后上报（QueryScheduler）
  // ---------------------------
  interface ViewportSnapshot {
    scrollTop: number;
    height: number;
    gridTopInScrollContent: number;
  }

  const viewport = ref<ViewportSnapshot>({
    scrollTop: 0,
    height: 0,
    gridTopInScrollContent: 0,
  });

  const updateViewport = () => {
    const scroller = resolvedScrollEl.value;
    const container = contentRef.value;
    if (!scroller || !container) return;

    const scrollTop = scroller.scrollTop;
    const height = scroller.clientHeight;

    const scrollRect = scroller.getBoundingClientRect();
    const gridRect = container.getBoundingClientRect();
    const gridTopInScrollContent = gridRect.top - scrollRect.top + scrollTop;

    viewport.value = { scrollTop, height, gridTopInScrollContent };

    // 触底判断（基于 sentinel 的实际位置）：比 IntersectionObserver 更“即时”，同时也可作为兜底。
    const sentinel = sentinelRef.value;
    if (!sentinel) return;

    const thresholdPx = Math.max(0, Math.floor(props.thresholdPx ?? 0));
    const sentinelRect = sentinel.getBoundingClientRect();
    const nextNearBottom = sentinelRect.top - scrollRect.bottom <= thresholdPx;
    autoLoad.setNearBottom(nextNearBottom);
  };

  let rafId: number | null = null;
  const scheduleViewportUpdate = () => {
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      updateViewport();
    });
  };

  const canMeasureViewport = computed(() => Boolean(resolvedScrollEl.value && contentRef.value));

  const computeRange = computed(() => {
    const { scrollTop, height, gridTopInScrollContent } = viewport.value;
    const viewportTopInGrid = scrollTop - gridTopInScrollContent;
    return { viewportTopInGrid, viewportHeight: height };
  });

  const hotRange = computed(() => {
    const { viewportTopInGrid, viewportHeight } = computeRange.value;
    const overscanPx = viewportHeight * Math.max(0, props.hotOverscanScreens ?? 0);
    return {
      top: viewportTopInGrid - overscanPx,
      bottom: viewportTopInGrid + viewportHeight + overscanPx,
    };
  });

  const estimateItemRect = (item: PanelLayout): { top: number; bottom: number } => {
    // 与 vue-grid-layout-v3 的 calcPosition 保持一致：
    // top = rowHeight*y + (y+1)*marginY = marginY + y*(rowHeight+marginY)
    const rowUnit = (props.rowHeight ?? 0) + (props.marginY ?? 0);
    const top = (props.marginY ?? 0) + item.y * rowUnit;
    const height = item.h * (props.rowHeight ?? 0) + Math.max(0, item.h - 1) * (props.marginY ?? 0);
    return { top, bottom: top + height };
  };

  const hotFallbackCount = computed(() => Math.max(10, threshold.value, 20));

  const hotIds = ref<Set<string>>(new Set());
  const hydratedIds = ref<Set<string>>(new Set());

  const renderList = computed<PanelLayout[]>(() => {
    if (!virtualizeWanted.value) return dataList.value;
    if (!canMeasureViewport.value || viewport.value.height <= 0) {
      return dataList.value.slice(0, hotFallbackCount.value);
    }

    const { top, bottom } = hotRange.value;
    return dataList.value.filter((it) => {
      const r = estimateItemRect(it);
      return r.bottom >= top && r.top <= bottom;
    });
  });

  const computeHotIds = (): string[] => {
    // 小数据量：认为当前已加载的全部都是 hot（请求量可控）
    if (!virtualizeWanted.value) {
      return dataList.value.map((it) => normalizeId(it.i));
    }

    if (!canMeasureViewport.value) {
      return dataList.value.slice(0, hotFallbackCount.value).map((it) => normalizeId(it.i));
    }

    const { top, bottom } = hotRange.value;
    const ids: string[] = [];
    for (const it of dataList.value) {
      const r = estimateItemRect(it);
      if (r.bottom >= top && r.top <= bottom) ids.push(normalizeId(it.i));
    }
    return ids;
  };

  const isScrolling = ref(false);
  let visibilityGeneration = 0;

  const applyHotVisible = async () => {
    const startedGen = visibilityGeneration;
    updateViewport();
    const ids = computeHotIds();
    hotIds.value = new Set(ids);

    const nextHydrated = new Set(hydratedIds.value);
    ids.forEach((id) => nextHydrated.add(id));
    hydratedIds.value = nextHydrated;

    await nextTick();
    if (virtualizeWanted.value && startedGen !== visibilityGeneration) return;
    scheduler.setVisiblePanels?.(props.scopeId, ids);

    isScrolling.value = false;
  };

  let idleTimer: number | null = null;
  const scheduleApplyHotVisible = () => {
    if (idleTimer != null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    const delay = Math.max(0, props.idleMs ?? 0);
    idleTimer = window.setTimeout(() => {
      idleTimer = null;
      void applyHotVisible();
    }, delay);
  };

  const onScroll = () => {
    if (!props.enabled) return;
    const nextTop = resolvedScrollEl.value?.scrollTop ?? 0;
    if (nextTop !== lastScrollTopForIntent) {
      if (!suppressScrollIntent) autoLoad.setUserInteracted();
      lastScrollTopForIntent = nextTop;
    }

    scheduleViewportUpdate();

    visibilityGeneration++;

    if (virtualizeWanted.value) {
      if (!isScrolling.value) {
        scheduler.setVisiblePanels?.(props.scopeId, []);
      }
      isScrolling.value = true;
      scheduleApplyHotVisible();
    } else {
      void applyHotVisible();
    }
  };

  const isHot = (id: PanelId): boolean => (!virtualizeWanted.value ? true : hotIds.value.has(normalizeId(id)));
  const isHydrated = (id: PanelId): boolean => (!virtualizeWanted.value ? true : hydratedIds.value.has(normalizeId(id)));

  let boundScrollEl: HTMLElement | null = null;
  const attachScrollListeners = () => {
    const el = resolvedScrollEl.value;
    if (!el || boundScrollEl === el) return;

    if (boundScrollEl) {
      boundScrollEl.removeEventListener('scroll', onScroll);
      boundScrollEl.removeEventListener('wheel', onUserIntent);
      boundScrollEl.removeEventListener('touchmove', onUserIntent);
      boundScrollEl.removeEventListener('pointerdown', onUserIntent);
    }
    boundScrollEl = el;
    boundScrollEl.addEventListener('scroll', onScroll, { passive: true });
    boundScrollEl.addEventListener('wheel', onUserIntent, { passive: true });
    boundScrollEl.addEventListener('touchmove', onUserIntent, { passive: true });
    boundScrollEl.addEventListener('pointerdown', onUserIntent);
  };

  const detachScrollListeners = () => {
    if (!boundScrollEl) return;
    boundScrollEl.removeEventListener('scroll', onScroll);
    boundScrollEl.removeEventListener('wheel', onUserIntent);
    boundScrollEl.removeEventListener('touchmove', onUserIntent);
    boundScrollEl.removeEventListener('pointerdown', onUserIntent);
    boundScrollEl = null;
  };

  const onUserIntent = () => {
    autoLoad.setUserInteracted();
  };

  onMounted(() => {
    updateViewport();
    void reset();

    attachScrollListeners();
    scheduleViewportUpdate();
  });

  onBeforeUnmount(() => {
    detachScrollListeners();
    autoLoad.reset();
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    visibilityGeneration++;
    if (idleTimer != null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    scheduler.setVisiblePanels?.(props.scopeId, []);
  });

  watch(
    () => props.resetKey,
    () => {
      void reset();
    }
  );

  watch(
    () => resolvedScrollEl.value,
    () => {
      lastScrollTopForIntent = resolvedScrollEl.value?.scrollTop ?? 0;
      attachScrollListeners();
      scheduleViewportUpdate();
    }
  );

  watch(
    () => props.pageSize,
    () => {
      void reset();
    }
  );

  defineSlots<{
    default: (props: {
      dataList: PanelLayout[];
      renderList: PanelLayout[];
      loading: boolean;
      loadingMore: boolean;
      loadingMorePending: boolean;
      hasMore: boolean;
      loadMore: () => Promise<void>;
      reset: () => Promise<void>;
      isHot: (id: PanelId) => boolean;
      isHydrated: (id: PanelId) => boolean;
      isVirtualizing: boolean;
      isScrolling: boolean;
      totalCount: number;
    }) => any;
  }>();
</script>

<style scoped lang="less">
  .dp-virtual-list {
    width: 100%;
  }

  .dp-virtual-list__content {
    width: 100%;
  }

  .dp-virtual-list__sentinel {
    width: 100%;
    pointer-events: none;
  }
</style>
