import type { PanelLayout } from '@grafana-fast/types';

export interface VirtualViewportSnapshot {
  scrollTop: number;
  height: number;
  gridTopInScrollContent: number;
}

export interface HotRange {
  top: number;
  bottom: number;
}

interface EstimateItemRectOptions {
  rowHeight: number;
  marginY: number;
  rowUnitPx: number;
}

export function getEffectiveViewportHeight(scroller: HTMLElement | null | undefined, fallbackHeight: number): number {
  const clientHeight = scroller?.clientHeight ?? 0;
  const safeClientHeight = clientHeight > 0 ? clientHeight : fallbackHeight;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : safeClientHeight;
  // runtime scroll 容器如果没有正确约束高度，clientHeight 可能会变得非常大（等于内容高度）。
  // clamp 到 window.innerHeight，避免“首屏一次加载太多页”的误判。
  const safeWinHeight = winHeight > 0 ? winHeight : safeClientHeight;
  return Math.max(1, Math.min(safeClientHeight, safeWinHeight));
}

export function getHotRange(viewport: VirtualViewportSnapshot, overscanScreens: number): HotRange {
  const viewportTopInGrid = viewport.scrollTop - viewport.gridTopInScrollContent;
  const overscanPx = viewport.height * Math.max(0, overscanScreens);
  return {
    top: viewportTopInGrid - overscanPx,
    bottom: viewportTopInGrid + viewport.height + overscanPx,
  };
}

export function estimateItemRect(item: PanelLayout, options: EstimateItemRectOptions): { top: number; bottom: number } {
  // 与当前 grid-layout 的 calcPosition 保持一致：
  // top = rowHeight*y + (y+1)*marginY = marginY + y*(rowHeight+marginY)
  const rowHeight = Math.max(0, options.rowHeight);
  const marginY = Math.max(0, options.marginY);
  const rowUnit = Math.max(1, options.rowUnitPx);
  const top = marginY + (item.y ?? 0) * rowUnit;
  const h = Math.max(0, item.h ?? 0);
  const height = h * rowHeight + Math.max(0, h - 1) * marginY;
  return { top, bottom: top + height };
}

export function computeHotIds(items: PanelLayout[], range: HotRange, estimateOptions: EstimateItemRectOptions): string[] {
  const ids: string[] = [];
  for (const it of items) {
    const r = estimateItemRect(it, estimateOptions);
    if (r.bottom >= range.top && r.top <= range.bottom) {
      ids.push(String(it.i));
    }
  }
  return ids;
}

export function filterRenderItems(
  items: PanelLayout[],
  range: HotRange,
  pinned: Set<string>,
  estimateOptions: EstimateItemRectOptions
): PanelLayout[] {
  return items.filter((it) => {
    const id = String(it.i);
    if (pinned.has(id)) return true;
    const r = estimateItemRect(it, estimateOptions);
    return r.bottom >= range.top && r.top <= range.bottom;
  });
}
