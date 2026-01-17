import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { PanelLayout } from '@grafana-fast/types';
import { usePagination } from '@grafana-fast/component';
import { getPiniaQueryScheduler } from '/#/runtime/piniaAttachments';
import { useDashboardRuntime } from '/#/runtime/useInjected';
import { debounceCancellable } from '/#/utils';

export interface UseVirtualizedGridPanelsOptions {
  /**
   * 可见性 scope id（推荐用 groupId）。
   * - 同一 dashboard 内多个 GridLayout 会并存；scheduler 需要按 scope 聚合可见面板集合。
   */
  scopeId: string;
  /**
   * GridLayout 的 layout（通常是完整 layout）。
   */
  layout: Ref<PanelLayout[]>;
  /**
   * vue-grid-layout-v3 的 rowHeight。
   */
  rowHeight: number;
  /**
   * vue-grid-layout-v3 的 marginY（第二个值）。
   */
  marginY: number;
  /**
   * 每页 panel 数量（分页器）。
   */
  pageSize?: number;
  /**
   * 初始页码（默认 1）。
   */
  initialPage?: number;
  /**
   * overscan 以“屏幕高度”为单位。
   * - 0.5 表示上下各 0.5 屏
   */
  overscanScreens?: number;
  /**
   * 是否启用（编辑模式建议禁用，避免拖拽/缩放与虚拟化产生复杂交互）。
   */
  enabled?: Ref<boolean>;
  /**
   * GridLayout 外层容器（用于测量 offset）。
   */
  containerRef: Ref<HTMLElement | null>;
}

interface ViewportSnapshot {
  scrollTop: number;
  height: number;
  gridTopInScrollContent: number;
}

function sortLayoutForPaging(layout: PanelLayout[]): PanelLayout[] {
  return [...layout].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return String(a.i).localeCompare(String(b.i));
  });
}

function estimateItemRect(
  item: PanelLayout,
  rowHeight: number,
  marginY: number
): {
  top: number;
  bottom: number;
} {
  const rowUnit = rowHeight + marginY;
  const top = item.y * rowUnit;
  const height = item.h * rowHeight + Math.max(0, item.h - 1) * marginY;
  return { top, bottom: top + height };
}

function estimateTotalHeight(layout: PanelLayout[], rowHeight: number, marginY: number): number {
  const maxRows = layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  if (maxRows <= 0) return 200;
  // Enough to preserve scroll geometry; exact match is not required because we overscan.
  return maxRows * rowHeight + Math.max(0, maxRows - 1) * marginY + marginY * 2;
}

/**
 * 虚拟化 + “分页加载” + 只刷新可视区域（上下各 0.5 屏）的聚合 hook。
 *
 * 设计目标：
 * - 大组（例如 1000 panels）首次展开不渲染/不刷新全部
 * - 用户滚动时只渲染 viewport + overscan 的 panels
 * - QueryScheduler 只刷新 viewport + overscan 的 panels，滚动时再刷新新进入视口的部分
 */
export function useVirtualizedGridPanels(options: UseVirtualizedGridPanelsOptions) {
  const runtime = useDashboardRuntime();
  const scheduler = getPiniaQueryScheduler();

  const enabled = computed(() => options.enabled?.value ?? true);
  const scrollEl = computed(() => runtime.scrollEl?.value ?? null);

  const pageSizeDefault = computed(() => Math.max(1, options.pageSize ?? 20));
  const overscanScreens = computed(() => Math.max(0, options.overscanScreens ?? 0.5));

  const totalCount = computed(() => options.layout.value.length);

  const { page, pageSize, pageCount, start, end, setPage, setPageSize, reset } = usePagination({
    total: totalCount,
    initialPage: options.initialPage ?? 1,
    initialPageSize: pageSizeDefault.value,
  });

  // Keep pageSize in sync if caller changes default (rare).
  watch(pageSizeDefault, (n) => setPageSize(n));

  // Paging is enabled for any group larger than one page.
  const hasPaging = computed(() => enabled.value && totalCount.value > pageSize.value);

  const viewport = ref<ViewportSnapshot>({
    scrollTop: 0,
    height: 0,
    gridTopInScrollContent: 0,
  });

  const updateViewport = () => {
    const scroller = scrollEl.value;
    const container = options.containerRef.value;
    if (!scroller || !container) return;

    const scrollTop = scroller.scrollTop;
    const height = scroller.clientHeight;

    // gridTopInScrollContent = containerTop(relative to scroll content)
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
      debouncedApplyVisible();
    });
  };

  const computeRange = computed(() => {
    const { scrollTop, height, gridTopInScrollContent } = viewport.value;
    const viewportTopInGrid = scrollTop - gridTopInScrollContent;
    const overscanPx = height * overscanScreens.value;
    const top = viewportTopInGrid - overscanPx;
    const bottom = viewportTopInGrid + height + overscanPx;
    return { top, bottom, height };
  });

  const sortedLayout = computed(() => sortLayoutForPaging(options.layout.value));

  const pagedLayout = computed(() => {
    if (!hasPaging.value) return sortedLayout.value;
    return sortedLayout.value.slice(start.value, end.value);
  });

  const rebasedPagedLayout = computed<PanelLayout[]>(() => {
    if (!hasPaging.value) return pagedLayout.value;
    const slice = pagedLayout.value;
    if (!slice.length) return slice;
    const minY = slice.reduce((m, it) => Math.min(m, it.y), slice[0]!.y);
    if (minY <= 0) return slice;
    // Rebase Y so each page starts from the top (avoid huge blank scroll area).
    return slice.map((it) => ({ ...it, y: it.y - minY }));
  });

  const layoutWindow = computed(() => (hasPaging.value ? rebasedPagedLayout.value : options.layout.value));

  const containerHeightPx = computed(() => estimateTotalHeight(layoutWindow.value, options.rowHeight, options.marginY));

  // Rendering virtualization is only needed for very large "current window" (e.g., if pageSize is large).
  const isVirtualizing = computed(() => enabled.value && layoutWindow.value.length > 120);

  const visiblePanelIdsForRefresh = computed(() => {
    // Fallback: without a known scroll container, treat "loaded" panels as visible.
    // This keeps dashboard functional in edge environments (e.g. tests or unusual embeddings).
    if (!scrollEl.value || !options.containerRef.value) {
      return layoutWindow.value.map((it) => it.i);
    }

    const { top, bottom } = computeRange.value;

    const ids: string[] = [];
    for (const it of layoutWindow.value) {
      const r = estimateItemRect(it, options.rowHeight, options.marginY);
      if (r.bottom >= top && r.top <= bottom) ids.push(it.i);
    }
    return ids;
  });

  const renderedLayout = computed(() => {
    // Rendering strategy:
    // - virtualizing: render viewport + overscan
    // - pagination-only: render current page (not viewport-filtered; keeps DOM stable)
    // - otherwise: render all
    if (isVirtualizing.value) {
      const visible = new Set(visiblePanelIdsForRefresh.value);
      return layoutWindow.value.filter((it) => visible.has(it.i));
    }

    return layoutWindow.value;
  });

  // Debounced update for scheduler visibility (avoid enqueue spam while scrolling fast).
  const applyVisibleToScheduler = () => {
    scheduler.setVisiblePanels?.(options.scopeId, visiblePanelIdsForRefresh.value);
  };

  const debouncedApplyVisible = debounceCancellable(applyVisibleToScheduler, 150);

  const onScroll = () => {
    if (!enabled.value) return;
    scheduleViewportUpdate();
  };

  onMounted(() => {
    const scroller = scrollEl.value;
    if (scroller) {
      scroller.addEventListener('scroll', onScroll, { passive: true });
    }
    // Ensure we have an initial viewport snapshot before computing visible panels.
    updateViewport();
    scheduleViewportUpdate();
    debouncedApplyVisible.flush();
  });

  onBeforeUnmount(() => {
    const scroller = scrollEl.value;
    scroller?.removeEventListener('scroll', onScroll);
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    debouncedApplyVisible.cancel();
    scheduler.setVisiblePanels?.(options.scopeId, []);
  });

  // layout changes (drag/drop, add/remove) -> recompute & refresh visibility snapshot.
  watch(
    () => options.layout.value,
    () => {
      scheduleViewportUpdate();
    },
    { deep: true }
  );

  watch([page, pageSize], () => {
    // Page change should immediately update scheduler-visible set.
    scheduleViewportUpdate();
    debouncedApplyVisible.flush();
  });

  return {
    hasPaging,
    isVirtualizing,
    totalCount,
    page,
    pageSize,
    pageCount,
    setPage,
    setPageSize,
    reset,
    containerHeightPx,
    renderedLayout,
  };
}
