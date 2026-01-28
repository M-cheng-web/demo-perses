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
      /**
       * 每次 query 的最大条数（或固定条数）
       * - `adaptivePageSize=true`：作为单次 query 的最大 limit（实际追加数量由 VirtualList 按视口/布局动态计算）
       * - `adaptivePageSize=false`：作为“每页固定数量”
       */
      pageSize?: number;
      /**
       * 是否按“下一页视口高度”自适应计算每页追加数量
       * - 默认开启（更贴近“加载到够一屏/两屏再停”）
       * - 关闭后使用固定 pageSize
       */
      adaptivePageSize?: boolean;
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
      /**
       * 渲染缓存容量（按 panel 数量）
       * - 目的：减少“滚出可视范围又滚回来”时的组件卸载/重建，从而避免 ECharts 重新 init / 重新 setOption 的“重画感”
       * - 代价：缓存越大，DOM/内存占用越高
       */
      keepAliveCount?: number;
      /** 用于外部数据变更时强制 reset（例如 layout / groupId 变化） */
      resetKey?: string | number;
    }>(),
    {
      scrollMode: 'runtime',
      height: 560,
      pageSize: 50,
      adaptivePageSize: true,
      thresholdPx: 200,
      idleMs: 200,
      enabled: true,
      virtualizeThreshold: 10,
      rowHeight: 30,
      marginY: 10,
      hotOverscanScreens: 0.25,
      keepAliveCount: 50,
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

  /**
   * debug 输出（仅 DEV）
   * 约定：只打印“关键路径 + 关键字段”，避免刷屏。
   */
  const debug = (event: string, payload?: Record<string, unknown>) => {
    if (!import.meta.env.DEV) return;
    const prefix = `[虚拟列表:${props.scopeId}]`;

    const map: Record<string, string> = {
      'reset:start': '重置：开始',
      'reset:query': '重置：请求',
      'reset:result': '重置：结果',
      'reset:done': '重置：完成',
      'loadMore:start': '加载更多：开始',
      'loadMore:query': '加载更多：请求',
      'loadMore:result': '加载更多：结果',
      'loadMore:done': '加载更多：完成',
      'viewport:nearBottom': '触底判定变化',
      'render:stats': '渲染统计',
      'adaptive:query': '自适应：请求更多以凑够一屏',
      'prefetchAll:start': '预取全量：开始（编辑模式）',
      'prefetchAll:done': '预取全量：完成（编辑模式）',
    };

    const title = map[event] ?? event;
    if (!payload) {
      console.log(prefix, title);
      return;
    }

    // 保持输出短小：只打印一层字段（避免大对象/数组）
    const safePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (Array.isArray(v)) safePayload[k] = `Array(${v.length})`;
      else if (v && typeof v === 'object') safePayload[k] = v;
      else safePayload[k] = v;
    }

    console.log(prefix, title, safePayload);
  };

  const getEffectiveViewportHeight = (scroller: HTMLElement | null | undefined): number => {
    const fallback = DEFAULT_SELF_HEIGHT_PX;
    const clientHeight = scroller?.clientHeight ?? 0;
    const safeClientHeight = clientHeight > 0 ? clientHeight : fallback;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : safeClientHeight;
    // runtime scroll 容器如果没有正确约束高度，clientHeight 可能会变得非常大（等于内容高度）。
    // clamp 到 window.innerHeight，避免“首屏一次加载太多页”的误判。
    const safeWinHeight = winHeight > 0 ? winHeight : safeClientHeight;
    return Math.max(1, Math.min(safeClientHeight, safeWinHeight));
  };

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

  // adaptivePageSize=true 时：query 可能会“多取少用”，剩余 items 会进入 buffer
  let prefetchedBuffer: PanelLayout[] = [];
  // query 返回的 total（如果存在）；用于在仅消费 buffer 时保持 totalCount 稳定
  let totalFromQuery: number | null = null;
  // 已加载（dataList）的最大 bottom（单位：grid row units；=max(y+h)）
  let loadedMaxBottomUnits = 0;

  // 渲染缓存（LRU）：用于减少滚动来回导致的卸载/重建
  const pinnedIds = ref<Set<string>>(new Set());
  let pinnedQueue: string[] = [];

  const toUnits = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const getTopUnits = (it: PanelLayout): number => Math.max(0, toUnits((it as any).y));
  const getBottomUnits = (it: PanelLayout): number => Math.max(0, getTopUnits(it) + Math.max(0, toUnits((it as any).h)));
  const computeMaxBottomUnits = (items: PanelLayout[]): number => {
    let maxBottom = 0;
    for (const it of items) {
      maxBottom = Math.max(maxBottom, getBottomUnits(it));
    }
    return maxBottom;
  };

  const applyQueryResult = (items: PanelLayout[], total?: number, lastFetchedLength?: number, bufferLength = 0) => {
    dataList.value = items;
    if (typeof total === 'number' && Number.isFinite(total)) {
      totalCount.value = Math.max(0, Math.floor(total));
      hasMore.value = dataList.value.length < totalCount.value;
      return;
    }
    totalCount.value = dataList.value.length + Math.max(0, bufferLength);
    // 没有 total 时只能用“是否拿满 pageSize”来猜测
    const fetchedLen = typeof lastFetchedLength === 'number' ? lastFetchedLength : items.length;
    hasMore.value = bufferLength > 0 || fetchedLen >= Math.max(1, props.pageSize ?? 0);
  };

  const getQueryChunkLimit = (): number => Math.max(1, Math.floor(props.pageSize ?? 1));

  const ADAPTIVE_PREFETCH_SCREENS = 2;
  const getAdaptiveTargetAddedUnits = (viewportHeightPx: number): number => {
    const rowUnitPx = Math.max(1, (props.rowHeight ?? 0) + (props.marginY ?? 0));
    return Math.max(1, Math.ceil((viewportHeightPx / rowUnitPx) * ADAPTIVE_PREFETCH_SCREENS));
  };

  type AdaptiveAppendResult = {
    appended: PanelLayout[];
    nextBuffer: PanelLayout[];
    total?: number;
    lastFetchedLength: number;
    nextMaxBottomUnits: number;
  };

  /**
   * 计算“自适应下一页”要追加的 items
   * - 以当前已加载内容的 max(y+h) 为 base
   * - 目标：追加到 base + N 屏高度（单位：grid units）
   * - 停止条件：当前 maxBottom 已达标，且下一项 y 已超出目标范围
   */
  const computeAdaptiveAppend = async (gen: number, viewportHeightPx: number): Promise<AdaptiveAppendResult | null> => {
    const baseMaxBottomUnits = loadedMaxBottomUnits;
    const targetAddedUnits = getAdaptiveTargetAddedUnits(viewportHeightPx);
    const targetBottomUnits = baseMaxBottomUnits + targetAddedUnits;
    const maxChunk = getQueryChunkLimit();

    const baseLoadedCount = dataList.value.length;
    let buffer = prefetchedBuffer.slice();
    let bufferCursor = 0;

    const appended: PanelLayout[] = [];
    let currentMaxBottomUnits = baseMaxBottomUnits;
    let lastFetchedLength = 0;
    let total: number | undefined = totalFromQuery ?? undefined;

    // 兜底：避免异常 query 导致死循环
    const maxFetchRounds = 50;
    let fetchRounds = 0;

    const remainingBuffer = () => buffer.length - bufferCursor;

    while (fetchRounds < maxFetchRounds) {
      // buffer 空 -> 继续 fetch 下一段（offset 始终基于“已加载+本次要追加”）
      if (remainingBuffer() <= 0) {
        const offset = baseLoadedCount + appended.length;
        const limit = maxChunk;
        debug('adaptive:query', { gen, offset, limit, viewportHeight: viewportHeightPx, targetBottomUnits });
        const res = await Promise.resolve(props.query({ offset, limit, viewportHeight: viewportHeightPx }));
        if (gen !== queryGeneration) return null;

        const normalized = normalizeQueryResult(res);
        lastFetchedLength = normalized.items.length;
        if (typeof normalized.total === 'number' && Number.isFinite(normalized.total)) {
          total = Math.max(0, Math.floor(normalized.total));
        }
        if (!normalized.items.length) break;

        buffer = normalized.items;
        bufferCursor = 0;
        fetchRounds += 1;
        continue;
      }

      const next = buffer[bufferCursor];
      if (!next) break;
      const nextY = getTopUnits(next);
      if (currentMaxBottomUnits >= targetBottomUnits && nextY > targetBottomUnits) break;

      appended.push(next);
      currentMaxBottomUnits = Math.max(currentMaxBottomUnits, getBottomUnits(next));
      bufferCursor += 1;
    }

    return {
      appended,
      nextBuffer: buffer.slice(bufferCursor),
      total,
      lastFetchedLength,
      nextMaxBottomUnits: currentMaxBottomUnits,
    };
  };

  const reset = async () => {
    queryGeneration++;
    const gen = queryGeneration;

    debug('reset:start', {
      gen,
      resetKey: props.resetKey,
      enabled: props.enabled,
      scrollMode: props.scrollMode,
      pageSize: props.pageSize,
    });

    loading.value = true;
    loadingMore.value = false;
    hasMore.value = true;
    totalCount.value = 0;
    dataList.value = [];
    prefetchedBuffer = [];
    totalFromQuery = null;
    loadedMaxBottomUnits = 0;
    pinnedIds.value = new Set();
    pinnedQueue = [];
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
      const viewportHeight = getEffectiveViewportHeight(resolvedScrollEl.value);
      const limit = getQueryChunkLimit();
      debug('reset:query', { gen, offset: 0, limit, viewportHeight, adaptivePageSize: props.adaptivePageSize });

      if (props.adaptivePageSize) {
        const r = await computeAdaptiveAppend(gen, viewportHeight);
        if (!r) return;

        prefetchedBuffer = r.nextBuffer;
        if (typeof r.total === 'number') totalFromQuery = r.total;
        loadedMaxBottomUnits = r.nextMaxBottomUnits;

        const total = totalFromQuery ?? undefined;
        debug('reset:result', { gen, fetched: r.lastFetchedLength, appended: r.appended.length, buffered: prefetchedBuffer.length, total });
        applyQueryResult(r.appended, total, r.lastFetchedLength, prefetchedBuffer.length);
      } else {
        const res = await Promise.resolve(props.query({ offset: 0, limit, viewportHeight }));
        if (gen !== queryGeneration) return;
        const { items, total } = normalizeQueryResult(res);

        totalFromQuery = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : null;
        loadedMaxBottomUnits = computeMaxBottomUnits(items);

        debug('reset:result', { gen, fetched: items.length, appended: items.length, buffered: 0, total: totalFromQuery ?? undefined });
        applyQueryResult(items, totalFromQuery ?? undefined, items.length, 0);
      }
    } finally {
      if (gen === queryGeneration) loading.value = false;
    }

    await nextTick();
    scheduleViewportUpdate();
    void applyHotVisible();

    debug('render:stats', {
      dataList: dataList.value.length,
      renderList: renderList.value.length,
      pinned: pinnedIds.value.size,
      keepAliveCount: props.keepAliveCount,
    });

    debug('reset:done', {
      gen,
      dataList: dataList.value.length,
      totalCount: totalCount.value,
      hasMore: hasMore.value,
    });
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
    const source = _source;
    debug('loadMore:start', {
      gen,
      source,
      pageSize: props.pageSize,
      adaptivePageSize: props.adaptivePageSize,
      offset,
      buffered: prefetchedBuffer.length,
      nearBottom: isNearBottom.value,
      totalCount: totalCount.value,
      hasMore: hasMore.value,
    });
    try {
      const viewportHeight = getEffectiveViewportHeight(resolvedScrollEl.value);
      const limit = getQueryChunkLimit();
      debug('loadMore:query', { gen, source, offset, limit, viewportHeight, adaptivePageSize: props.adaptivePageSize });

      if (props.adaptivePageSize) {
        const r = await computeAdaptiveAppend(gen, viewportHeight);
        if (!r) return;

        prefetchedBuffer = r.nextBuffer;
        if (typeof r.total === 'number') totalFromQuery = r.total;
        loadedMaxBottomUnits = r.nextMaxBottomUnits;

        const total = totalFromQuery ?? undefined;
        debug('loadMore:result', {
          gen,
          source,
          fetched: r.lastFetchedLength,
          appended: r.appended.length,
          buffered: prefetchedBuffer.length,
          total,
        });

        if (!r.appended.length) {
          // 兜底：避免空页导致无限触发
          hasMore.value = false;
          if (typeof total === 'number') totalCount.value = total;
        } else {
          const next = [...dataList.value, ...r.appended];
          applyQueryResult(next, total, r.lastFetchedLength, prefetchedBuffer.length);
        }
      } else {
        // fixed page-size：不使用 buffer，避免切换模式时的重复/错位
        prefetchedBuffer = [];
        const res = await Promise.resolve(props.query({ offset, limit, viewportHeight }));
        if (gen !== queryGeneration) return;

        const { items, total } = normalizeQueryResult(res);
        totalFromQuery = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : null;

        debug('loadMore:result', {
          gen,
          source,
          fetched: items.length,
          appended: items.length,
          buffered: 0,
          total: totalFromQuery ?? undefined,
        });

        if (!items.length) {
          // 兜底：避免空页导致无限触发
          hasMore.value = false;
          if (typeof totalFromQuery === 'number') totalCount.value = totalFromQuery;
        } else {
          loadedMaxBottomUnits = Math.max(loadedMaxBottomUnits, computeMaxBottomUnits(items));
          const next = [...dataList.value, ...items];
          applyQueryResult(next, totalFromQuery ?? undefined, items.length, 0);
        }
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
      debug('loadMore:done', {
        gen,
        source,
        dataList: dataList.value.length,
        totalCount: totalCount.value,
        hasMore: hasMore.value,
      });
    }
  }

  const loadMore = async () => {
    await autoLoad.loadMoreManual();
  };

  type PrefetchAllOptions = {
    /**
     * 兜底：最多执行多少轮 loadMore（避免异常 total 导致死循环）
     */
    maxRounds?: number;
  };

  /**
   * 拉取到完整数据（不清空已有 dataList/hydratedIds）
   * - 典型场景：进入编辑模式时，希望一次性拿到全量 layout，避免拖拽/缩放出现“断层”
   * - 与 reset() 的差异：prefetchAll 只追加，不会触发可视集合清空/骨架闪动
   */
  const prefetchAll = async (options?: PrefetchAllOptions) => {
    if (!props.enabled) return;
    const pageSize = getQueryChunkLimit();
    const fallbackRounds = 20;
    const total = typeof totalFromQuery === 'number' ? totalFromQuery : totalCount.value;
    const remaining = Math.max(0, (total || 0) - dataList.value.length);
    const estimatedRounds = total > 0 ? Math.ceil(remaining / pageSize) + 2 : fallbackRounds;
    const maxRounds = Math.max(1, Math.floor(options?.maxRounds ?? estimatedRounds));

    debug('prefetchAll:start', {
      pageSize,
      maxRounds,
      dataList: dataList.value.length,
      totalCount: totalCount.value,
      buffered: prefetchedBuffer.length,
      hasMore: hasMore.value,
    });

    let rounds = 0;
    while (hasMore.value && rounds < maxRounds) {
      const before = dataList.value.length;
      const viewportHeight = getEffectiveViewportHeight(resolvedScrollEl.value);
      const gen = queryGeneration;

      // 先把已预取但未追加的 buffer 全部入库（prefetchAll 的目标就是全量）
      if (prefetchedBuffer.length) {
        const buffered = prefetchedBuffer;
        prefetchedBuffer = [];

        loadedMaxBottomUnits = Math.max(loadedMaxBottomUnits, computeMaxBottomUnits(buffered));
        const next = [...dataList.value, ...buffered];

        // total 未知时不要把 hasMore 错误置 false：继续尝试 query，直到返回空页
        applyQueryResult(next, totalFromQuery ?? undefined, buffered.length, 0);
        if (totalFromQuery == null) hasMore.value = true;
      } else {
        const offset = dataList.value.length;
        const limit = pageSize;
        const res = await Promise.resolve(props.query({ offset, limit, viewportHeight }));
        if (gen !== queryGeneration) return;

        const { items, total } = normalizeQueryResult(res);
        if (typeof total === 'number' && Number.isFinite(total)) {
          totalFromQuery = Math.max(0, Math.floor(total));
        }

        if (!items.length) {
          hasMore.value = false;
          if (typeof totalFromQuery === 'number') totalCount.value = totalFromQuery;
        } else {
          loadedMaxBottomUnits = Math.max(loadedMaxBottomUnits, computeMaxBottomUnits(items));
          const next = [...dataList.value, ...items];
          applyQueryResult(next, totalFromQuery ?? undefined, items.length, 0);
        }
      }

      const after = dataList.value.length;
      rounds += 1;
      // loadMore 未推进（被节流/兜底）-> 退出，避免无限循环
      if (after <= before) break;
    }

    await nextTick();
    scheduleViewportUpdate();
    void applyHotVisible();

    debug('prefetchAll:done', {
      rounds,
      dataList: dataList.value.length,
      totalCount: totalCount.value,
      buffered: prefetchedBuffer.length,
      hasMore: hasMore.value,
    });
  };

  defineExpose({
    reset,
    loadMore,
    prefetchAll,
  });

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
    const height = getEffectiveViewportHeight(scroller);

    const scrollRect = scroller.getBoundingClientRect();
    const gridRect = container.getBoundingClientRect();
    const gridTopInScrollContent = gridRect.top - scrollRect.top + scrollTop;

    viewport.value = { scrollTop, height, gridTopInScrollContent };

    // 触底判断（基于 sentinel 的实际位置）：比 IntersectionObserver 更“即时”，同时也可作为兜底。
    const sentinel = sentinelRef.value;
    if (!sentinel) return;

    const thresholdPx = Math.max(0, Math.floor(props.thresholdPx ?? 0));
    const sentinelRect = sentinel.getBoundingClientRect();
    const viewportBottom = typeof window !== 'undefined' ? Math.min(scrollRect.bottom, window.innerHeight) : scrollRect.bottom;
    const distanceToBottomPx = sentinelRect.top - viewportBottom;
    // 关键：避免 distance 为“大负值”时也被判定为 near-bottom，导致首屏误触发多轮加载
    const nextNearBottom = distanceToBottomPx <= thresholdPx && distanceToBottomPx >= -thresholdPx;
    if (nextNearBottom !== isNearBottom.value) {
      debug('viewport:nearBottom', {
        nextNearBottom,
        distanceToBottomPx: Math.floor(distanceToBottomPx),
        thresholdPx,
        scrollTop,
        viewportHeight: height,
        scrollRectBottom: Math.floor(scrollRect.bottom),
        viewportBottom: Math.floor(viewportBottom),
        dataList: dataList.value.length,
        totalCount: totalCount.value,
        hasMore: hasMore.value,
      });
    }
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

  const updatePinnedIds = (hotIdList: string[]) => {
    const maxKeep = Math.max(0, Math.floor(props.keepAliveCount ?? 0));
    if (maxKeep <= 0) {
      pinnedIds.value = new Set();
      pinnedQueue = [];
      return;
    }

    const current = new Set(pinnedIds.value);

    for (const id of hotIdList) {
      if (!current.has(id)) {
        current.add(id);
        pinnedQueue.push(id);
      }
    }

    const hotSet = new Set(hotIdList);
    while (current.size > maxKeep && pinnedQueue.length > 0) {
      const oldest = pinnedQueue.shift();
      if (!oldest) continue;
      // 当前仍在 hot 的不移除（优先保证可视范围稳定）
      if (hotSet.has(oldest)) {
        pinnedQueue.push(oldest);
        continue;
      }
      current.delete(oldest);
    }

    pinnedIds.value = current;
  };

  const renderList = computed<PanelLayout[]>(() => {
    if (!virtualizeWanted.value) return dataList.value;
    if (!canMeasureViewport.value || viewport.value.height <= 0) {
      return dataList.value.slice(0, hotFallbackCount.value);
    }

    const { top, bottom } = hotRange.value;
    const pinned = pinnedIds.value;
    return dataList.value.filter((it) => {
      const r = estimateItemRect(it);
      const id = normalizeId(it.i);
      if (pinned.has(id)) return true;
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
    updatePinnedIds(ids);

    const nextHydrated = new Set(hydratedIds.value);
    ids.forEach((id) => nextHydrated.add(id));
    hydratedIds.value = nextHydrated;

    await nextTick();
    if (virtualizeWanted.value && startedGen !== visibilityGeneration) return;
    scheduler.setVisiblePanels?.(props.scopeId, ids);

    isScrolling.value = false;

    debug('render:stats', {
      hot: ids.length,
      pinned: pinnedIds.value.size,
      hydrated: hydratedIds.value.size,
      dataList: dataList.value.length,
      renderList: renderList.value.length,
    });
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

  watch(
    () => props.adaptivePageSize,
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
