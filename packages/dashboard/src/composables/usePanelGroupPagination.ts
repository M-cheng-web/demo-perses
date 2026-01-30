import { computed, reactive, watch } from 'vue';
import type { Panel, PanelGroup, PanelLayout } from '@grafana-fast/types';

export interface UsePanelGroupPaginationOptions {
  /**
   * 每页条数默认值（每个组独立 state，但默认值共享）
   * @default 20
   */
  defaultPageSize?: number;
  /**
   * 可选 pageSize（用于 UI 展示；不强制限制 setPageSize 的值）
   * @default [20, 30]
   */
  pageSizeOptions?: number[];
  /**
   * 修改 pageSize 时是否强制回到第一页
   * - true：更符合“换每页条数=重新分页”的直觉
   * - false：尽量保持当前页（会自动 clamp）
   * @default true
   */
  resetPageOnPageSizeChange?: boolean;
}

export interface PagedPanelGroup {
  group: PanelGroup;
  total: number;
  pageSize: number;
  pageCount: number;
  currentPage: number;
  pagePanels: Panel[];
  /** 当前页布局（仅包含当前页 panels；y 已做页内 rebased，从 0 开始） */
  pageLayout: PanelLayout[];
  /** 当前页的 y 偏移（用于把编辑后的 y 写回到 group 的全量 layout） */
  layoutBaseY: number;
  /** 用于子组件 reset（例如 VirtualList/hydration） */
  pageKey: string;
}

const toPositiveInt = (n: unknown, fallback: number): number => {
  const next = Number(n);
  if (!Number.isFinite(next)) return fallback;
  const floored = Math.floor(next);
  return floored > 0 ? floored : fallback;
};

/**
 * 面板组分页（每组独立 current/pageSize），并派生出当前页的 pagePanels/pageLayout。
 *
 * 设计目标：
 * - pagination 仅用于“减少单次渲染/请求的元素数量”（配置依然是一口气拿到）
 * - 按 panels 数组顺序切片（不按 layout 顺序）
 * - layout 仅取当前页 panels 的项，并做 y rebased 避免巨大空白
 */
export function usePanelGroupPagination(panelGroups: () => PanelGroup[], options?: UsePanelGroupPaginationOptions) {
  const defaultPageSize = toPositiveInt(options?.defaultPageSize, 20);
  const pageSizeOptions = computed(() => {
    const opt = options?.pageSizeOptions ?? [20, 30];
    const normalized = opt
      .map((v) => toPositiveInt(v, 0))
      .filter((v) => v > 0)
      .filter((v, idx, arr) => arr.indexOf(v) === idx);
    return normalized.length > 0 ? normalized : [defaultPageSize];
  });
  const resetPageOnPageSizeChange = options?.resetPageOnPageSizeChange ?? true;

  const currentByGroupId = reactive<Record<string, number>>({});
  const pageSizeByGroupId = reactive<Record<string, number>>({});

  const normalizeGroupId = (groupId: PanelGroup['id']) => String(groupId);

  const getCurrentPage = (groupId: PanelGroup['id']): number => {
    const raw = currentByGroupId[normalizeGroupId(groupId)];
    return toPositiveInt(raw, 1);
  };

  const setCurrentPage = (groupId: PanelGroup['id'], page: number) => {
    currentByGroupId[normalizeGroupId(groupId)] = toPositiveInt(page, 1);
  };

  const getPageSize = (groupId: PanelGroup['id']): number => {
    const raw = pageSizeByGroupId[normalizeGroupId(groupId)];
    return toPositiveInt(raw, defaultPageSize);
  };

  const setPageSize = (groupId: PanelGroup['id'], pageSize: number) => {
    const key = normalizeGroupId(groupId);
    pageSizeByGroupId[key] = toPositiveInt(pageSize, defaultPageSize);
    if (resetPageOnPageSizeChange) {
      currentByGroupId[key] = 1;
    }
  };

  const clampGroupPages = () => {
    const groups = panelGroups();
    const aliveIds = new Set(groups.map((g) => normalizeGroupId(g.id)));

    // prune removed groups（避免 state 无限增长）
    for (const key of Object.keys(currentByGroupId)) {
      if (!aliveIds.has(key)) delete currentByGroupId[key];
    }
    for (const key of Object.keys(pageSizeByGroupId)) {
      if (!aliveIds.has(key)) delete pageSizeByGroupId[key];
    }

    for (const g of groups) {
      const total = g.panels?.length ?? 0;
      const size = Math.max(1, getPageSize(g.id));
      const pageCount = Math.max(1, Math.ceil(total / size));
      const current = getCurrentPage(g.id);
      if (current > pageCount) currentByGroupId[normalizeGroupId(g.id)] = pageCount;
    }
  };

  // 仅依赖“组 id + panels 数量”，避免 deep watch 大对象导致的额外开销
  const groupSummaryKey = computed(() => {
    const groups = panelGroups();
    return groups.map((g) => `${normalizeGroupId(g.id)}:${g.panels?.length ?? 0}`).join('|');
  });
  watch(groupSummaryKey, clampGroupPages, { immediate: true });

  const pagedGroups = computed<PagedPanelGroup[]>(() => {
    const groups = panelGroups();
    return groups.map((group) => {
      const total = group.panels?.length ?? 0;
      const pageSize = Math.max(1, getPageSize(group.id));
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(getCurrentPage(group.id), pageCount);

      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      const pagePanels = (group.panels ?? []).slice(start, end);

      const layoutById = new Map<string, PanelLayout>();
      (group.layout ?? []).forEach((it) => layoutById.set(String(it.i), it));

      // Build the page layout strictly by panels array order (per requirement).
      const rawLayout: PanelLayout[] = pagePanels.map((p, idx) => {
        const existing = layoutById.get(String(p.id));
        if (existing) return existing;

        // Fallback: missing layout entry (should be rare). Place it at the end to avoid overlap.
        return {
          i: p.id,
          x: 0,
          y: idx * 8,
          w: 24,
          h: 8,
          minW: 6,
          minH: 4,
        };
      });

      // Rebase Y so each page starts near the top (avoid huge blank space from original y).
      let minY = Number.POSITIVE_INFINITY;
      for (const it of rawLayout) minY = Math.min(minY, Number(it.y ?? 0));
      const layoutBaseY = Number.isFinite(minY) ? Math.max(0, minY) : 0;

      const pageLayout: PanelLayout[] = rawLayout.map((it) => ({
        ...it,
        y: Math.max(0, Number(it.y ?? 0) - layoutBaseY),
      }));

      return {
        group,
        total,
        pageSize,
        pageCount,
        currentPage,
        pagePanels,
        pageLayout,
        layoutBaseY,
        pageKey: `${normalizeGroupId(group.id)}:${currentPage}:${pageSize}`,
      };
    });
  });

  return {
    pagedGroups,
    pageSizeOptions,
    getCurrentPage,
    setCurrentPage,
    getPageSize,
    setPageSize,
  };
}

