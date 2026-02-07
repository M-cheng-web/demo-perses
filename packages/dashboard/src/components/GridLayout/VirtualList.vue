<!--
  组件说明：可视窗口 + idle 后激活请求的虚拟列表容器（VirtualList）

  目标（按 Grafana 的“滚动停留才加载内容”思路）：
  - 一次性传入全量 items（layout），不做分页、不做 loadMore
  - DOM 只渲染可视范围（hotRange）+ pinned 缓存，避免 1000+ 面板 DOM 压力
  - 滚动过程中：继续上报 renderPanelIds（避免白屏），但 activePanelIds 为空（暂停请求）
  - 停留 idleMs 后：上报 activePanelIds（恢复请求）
-->
<template>
  <div ref="containerRef" :class="bem()" :style="containerStyle">
    <div ref="contentRef" :class="bem('content')">
      <slot
        :data-list="dataList"
        :render-list="renderList"
        :is-hot="isHot"
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
  import {
    computeHotIds as computeHotIdsInRange,
    filterRenderItems,
    getEffectiveViewportHeight,
    getHotRange,
    type VirtualViewportSnapshot,
  } from './virtualListWindowing';
  import { computeNextPinnedCache } from './virtualListPinnedCache';

  defineOptions({ name: 'VirtualList' });

  type PanelId = PanelLayout['i'];

  const props = withDefaults(
    defineProps<{
      /** scheduler 的可视范围 scope（建议传 groupId） */
      scopeId: string;
      /** 全量 items（layout），VirtualList 只负责“渲染窗口化 + active 请求窗口” */
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

  // 激进定型：不再区分“小组/大组”，统一采用“窗口化渲染 + idle 后请求”的策略
  // enabled=false 作为兜底开关（一般不需要关）。
  const windowingEnabled = computed(() => Boolean(props.enabled));

  const normalizeId = (id: PanelId): string => String(id);
  /**
   * 多实例隔离：对 QueryScheduler 的 panelId/scopeId 做实例前缀。
   *
   * 背景：
   * - QueryScheduler 绑定在 pinia 上（默认按 pinia 隔离）。
   * - 但宿主应用可能选择 shared pinia，或者在调试/热重载时出现同页多实例并存。
   * - 这时如果直接使用 groupId/panelId（如 "group-1"/"panel-1"），会出现 scope/panel 冲突：
   *   - 可视集合串台（A dashboard 滚动影响 B dashboard 的可视刷新）
   *   - 同名 panel 的注册/刷新互相覆盖
   *
   * 方案：
   * - 统一用 `${runtime.id}:...` 作为 scheduler 的唯一键
   * - 组件内部渲染仍使用原始 id（不改变 layout/panels 的业务 id）
   */
  const schedulerScopeId = computed(() => `${runtime.id}:${props.scopeId}`);
  const toSchedulerPanelId = (id: string) => `${runtime.id}:${id}`;

  // 渲染缓存（LRU）：用于减少滚动来回导致的卸载/重建
  const pinnedIds = ref<Set<string>>(new Set());
  let pinnedQueue: string[] = [];

  // ---------------------------
  // 可视窗口 + idle 后上报（QueryScheduler）
  // ---------------------------
  const viewport = ref<VirtualViewportSnapshot>({
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
    const height = getEffectiveViewportHeight(scroller, DEFAULT_SELF_HEIGHT_PX);

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

  const hotRange = computed(() => getHotRange(viewport.value, props.hotOverscanScreens ?? 0));

  const estimateOptions = computed(() => ({
    rowHeight: props.rowHeight ?? 0,
    marginY: props.marginY ?? 0,
    rowUnitPx: rowUnitPx.value,
  }));

  // 无法测量 viewport 的兜底：只渲染前 N 个，避免一次性挂太多 DOM
  const hotFallbackCount = computed(() => 20);

  const hotIds = ref<Set<string>>(new Set());

  const updatePinnedIds = (hotIdList: string[]) => {
    const next = computeNextPinnedCache(
      {
        current: pinnedIds.value,
        queue: pinnedQueue,
      },
      hotIdList,
      props.keepAliveCount ?? 0
    );
    pinnedIds.value = next.current;
    pinnedQueue = next.queue;
  };

  const renderList = computed<PanelLayout[]>(() => {
    if (!windowingEnabled.value) return dataList.value;
    if (!canMeasureViewport.value || viewport.value.height <= 0) {
      return dataList.value.slice(0, hotFallbackCount.value);
    }

    return filterRenderItems(dataList.value, hotRange.value, pinnedIds.value, estimateOptions.value);
  });

  const computeHotIds = (): string[] => {
    if (!canMeasureViewport.value) {
      return dataList.value.slice(0, hotFallbackCount.value).map((it) => normalizeId(it.i));
    }

    return computeHotIdsInRange(dataList.value, hotRange.value, estimateOptions.value);
  };

  const isScrolling = ref(false);
  let visibilityGeneration = 0;

  const reportViewportState = (activeIds: string[]) => {
    const renderIds = renderList.value.map((it) => normalizeId(it.i)).map(toSchedulerPanelId);
    const activeSchedulerIds = activeIds.map(toSchedulerPanelId);

    scheduler.setViewportState(schedulerScopeId.value, {
      renderPanelIds: renderIds,
      activePanelIds: activeSchedulerIds,
    });
  };

  const applyHotVisible = async () => {
    if (!windowingEnabled.value) {
      const allIds = dataList.value.map((it) => normalizeId(it.i));
      hotIds.value = new Set(allIds);
      updatePinnedIds(allIds);
      isScrolling.value = false;
      reportViewportState(allIds);
      return;
    }
    const startedGen = visibilityGeneration;
    updateViewport();
    const ids = computeHotIds();
    hotIds.value = new Set(ids);
    updatePinnedIds(ids);

    isScrolling.value = false;
    reportViewportState(ids);

    await nextTick();
    if (startedGen !== visibilityGeneration) return;
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
    if (!windowingEnabled.value) {
      updateViewport();
      const allIds = dataList.value.map((it) => normalizeId(it.i));
      hotIds.value = new Set(allIds);
      updatePinnedIds(allIds);
      isScrolling.value = false;
      reportViewportState(allIds);
      return;
    }
    scheduleViewportUpdate();

    visibilityGeneration++;
    isScrolling.value = true;

    updateViewport();
    const ids = computeHotIds();
    hotIds.value = new Set(ids);
    updatePinnedIds(ids);
    reportViewportState([]);

    scheduleApplyHotVisible();
  };

  const isHot = (id: PanelId): boolean => (!windowingEnabled.value ? true : hotIds.value.has(normalizeId(id)));

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
    scheduler.setViewportState(schedulerScopeId.value, {
      renderPanelIds: [],
      activePanelIds: [],
    });
  });

  watch(
    () => props.resetKey,
    () => {
      hotIds.value = new Set();
      pinnedIds.value = new Set();
      pinnedQueue = [];
      isScrolling.value = false;
      visibilityGeneration++;
      scheduler.setViewportState(schedulerScopeId.value, {
        renderPanelIds: [],
        activePanelIds: [],
      });
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
      // items 变化只刷新 hot/pinned 计算
      scheduleViewportUpdate();
      void applyHotVisible();
    }
  );

  defineSlots<{
    default: (props: {
      dataList: PanelLayout[];
      renderList: PanelLayout[];
      isHot: (id: PanelId) => boolean;
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

    /* Scrollbar styling for self scroll mode */
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--gf-color-fill-secondary);
      border-radius: 3px;

      &:hover {
        background: var(--gf-color-fill);
      }
    }
  }

  .dp-virtual-list__content {
    width: 100%;
  }
</style>
