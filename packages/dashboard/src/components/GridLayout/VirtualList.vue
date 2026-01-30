<!--
  组件说明：可视窗口 + idle 后 hydrated 的虚拟列表容器（VirtualList）

  目标（按 Grafana 的“滚动停留才加载内容”思路）：
  - 一次性传入全量 items（layout），不做分页、不做 loadMore
  - DOM 只渲染可视范围（hotRange）+ pinned 缓存，避免 1000+ 面板 DOM 压力
  - 滚动过程中不更新“可视面板集合”（scheduler 可据此暂停查询/渲染），停留 idleMs 后再上报
  - hydratedIds 累积：已经真实渲染过的面板再次出现时可直接渲染内容（减少骨架闪烁）
-->
<template>
  <div ref="containerRef" :class="bem()" :style="containerStyle">
    <div ref="contentRef" :class="bem('content')">
      <slot
        :data-list="dataList"
        :render-list="renderList"
        :is-hot="isHot"
        :is-hydrated="isHydrated"
        :is-scrolling="isScrolling"
        :total-count="totalCount"
        :viewport-height-px="viewport.height"
        :row-unit-px="rowUnitPx"
      ></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import type { PanelLayout } from '@grafana-fast/types';
  import { createNamespace } from '/#/utils';
  import { useDashboardRuntime } from '/#/runtime/useInjected';
  import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';

  defineOptions({ name: 'VirtualList' });

  type PanelId = PanelLayout['i'];

  const props = withDefaults(
    defineProps<{
      /** scheduler 的可视范围 scope（建议传 groupId） */
      scopeId: string;
      /** 全量 items（layout），VirtualList 只负责“渲染窗口化 + hydrated” */
      items: PanelLayout[];
      /** 滚动容器来源：self=组件内部滚动；runtime=使用 Dashboard 外层滚动容器（默认） */
      scrollMode?: 'self' | 'runtime';
      /** 固定高度（例如 560 或 '560px'），组件内部自带滚动 */
      height?: number | string;
      /** 停止滚动多久后才允许上报可视集合（从而触发真实请求/渲染） */
      idleMs?: number;
      /** 是否启用（默认启用） */
      enabled?: boolean;
      /** 用于估算 grid-item 的 top/bottom（与当前 grid-layout 的 calcPosition 规则保持一致） */
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
      idleMs: 200,
      enabled: true,
      rowHeight: 30,
      marginY: 10,
      hotOverscanScreens: 0.5,
      keepAliveCount: 80,
      resetKey: undefined,
    }
  );

  const [_, bem] = createNamespace('virtual-list');
  const scheduler = getPiniaQueryScheduler();
  const runtime = useDashboardRuntime();

  const containerRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);

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

  const dataList = computed<PanelLayout[]>(() => (Array.isArray(props.items) ? props.items : []));
  const totalCount = computed(() => dataList.value.length);

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

  // 激进定型：不再区分“小组/大组”，统一采用“窗口化渲染 + idle 后 hydrated/请求”的策略
  // enabled=false 作为兜底开关（一般不需要关）。
  const windowingEnabled = computed(() => Boolean(props.enabled));

  const normalizeId = (id: PanelId): string => String(id);

  // 渲染缓存（LRU）：用于减少滚动来回导致的卸载/重建
  const pinnedIds = ref<Set<string>>(new Set());
  let pinnedQueue: string[] = [];

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

  const rowUnitPx = computed(() => Math.max(1, (props.rowHeight ?? 0) + (props.marginY ?? 0)));

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

  const hotRange = computed(() => {
    const { scrollTop, height, gridTopInScrollContent } = viewport.value;
    const viewportTopInGrid = scrollTop - gridTopInScrollContent;
    const overscanPx = height * Math.max(0, props.hotOverscanScreens ?? 0);
    return {
      top: viewportTopInGrid - overscanPx,
      bottom: viewportTopInGrid + height + overscanPx,
    };
  });

  const estimateItemRect = (item: PanelLayout): { top: number; bottom: number } => {
    // 与当前 grid-layout 的 calcPosition 保持一致：
    // top = rowHeight*y + (y+1)*marginY = marginY + y*(rowHeight+marginY)
    const rowHeight = Math.max(0, props.rowHeight ?? 0);
    const marginY = Math.max(0, props.marginY ?? 0);
    const rowUnit = rowUnitPx.value;
    const top = marginY + (item.y ?? 0) * rowUnit;
    const h = Math.max(0, item.h ?? 0);
    const height = h * rowHeight + Math.max(0, h - 1) * marginY;
    return { top, bottom: top + height };
  };

  // 无法测量 viewport 的兜底：只渲染前 N 个，避免一次性挂太多 DOM
  const hotFallbackCount = computed(() => 20);

  const hotIds = ref<Set<string>>(new Set());
  const hydratedIds = ref<Set<string>>(new Set());

  const updatePinnedIds = (hotIdList: string[]) => {
    const requestedMaxKeep = Math.max(0, Math.floor(props.keepAliveCount ?? 0));
    if (requestedMaxKeep <= 0) {
      pinnedIds.value = new Set();
      pinnedQueue = [];
      return;
    }

    const hotSet = new Set(hotIdList);
    // 关键修复：如果 hot 数量本身就超过 keepAliveCount，则不能“强行缩到 keepAliveCount”，
    // 否则会出现一直尝试删除 hot 元素而无法减少 size 的死循环。
    const maxKeep = Math.max(requestedMaxKeep, hotSet.size);

    const current = new Set(pinnedIds.value);

    for (const id of hotIdList) {
      if (!current.has(id)) {
        current.add(id);
        pinnedQueue.push(id);
      }
    }

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
    if (!windowingEnabled.value) return dataList.value;
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
    if (!windowingEnabled.value) return;
    const startedGen = visibilityGeneration;
    updateViewport();
    const ids = computeHotIds();
    hotIds.value = new Set(ids);
    updatePinnedIds(ids);

    const nextHydrated = new Set(hydratedIds.value);
    ids.forEach((id) => nextHydrated.add(id));
    hydratedIds.value = nextHydrated;

    await nextTick();
    if (startedGen !== visibilityGeneration) return;
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
    if (!windowingEnabled.value) return;
    scheduleViewportUpdate();

    visibilityGeneration++;

    if (!isScrolling.value) scheduler.setVisiblePanels?.(props.scopeId, []);
    isScrolling.value = true;
    scheduleApplyHotVisible();
  };

  const isHot = (id: PanelId): boolean => (!windowingEnabled.value ? true : hotIds.value.has(normalizeId(id)));
  const isHydrated = (id: PanelId): boolean => (!windowingEnabled.value ? true : hydratedIds.value.has(normalizeId(id)));

  let boundScrollEl: HTMLElement | null = null;
  const attachScrollListeners = () => {
    const el = resolvedScrollEl.value;
    if (!el || boundScrollEl === el) return;

    if (boundScrollEl) {
      boundScrollEl.removeEventListener('scroll', onScroll);
    }
    boundScrollEl = el;
    boundScrollEl.addEventListener('scroll', onScroll, { passive: true });
  };

  const detachScrollListeners = () => {
    if (!boundScrollEl) return;
    boundScrollEl.removeEventListener('scroll', onScroll);
    boundScrollEl = null;
  };

  onMounted(() => {
    updateViewport();
    attachScrollListeners();
    scheduleViewportUpdate();
    void applyHotVisible();
  });

  onBeforeUnmount(() => {
    detachScrollListeners();
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
      hotIds.value = new Set();
      hydratedIds.value = new Set();
      pinnedIds.value = new Set();
      pinnedQueue = [];
      isScrolling.value = false;
      visibilityGeneration++;
      scheduler.setVisiblePanels?.(props.scopeId, []);
      scheduleViewportUpdate();
      void applyHotVisible();
    }
  );

  watch(
    () => resolvedScrollEl.value,
    () => {
      attachScrollListeners();
      scheduleViewportUpdate();
      void applyHotVisible();
    }
  );

  watch(
    () => props.items,
    () => {
      // items 变化不清空 hydrated（避免闪动），只刷新 hot/pinned 计算
      scheduleViewportUpdate();
      void applyHotVisible();
    }
  );

  defineSlots<{
    default: (props: {
      dataList: PanelLayout[];
      renderList: PanelLayout[];
      isHot: (id: PanelId) => boolean;
      isHydrated: (id: PanelId) => boolean;
      isScrolling: boolean;
      totalCount: number;
      viewportHeightPx: number;
      rowUnitPx: number;
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
</style>
