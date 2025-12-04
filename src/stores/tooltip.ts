/**
 * Tooltip 全局状态管理
 * 用于管理多个图表之间的 Tooltip 固定状态和图表注册
 */

import { defineStore } from 'pinia';
import type { TimeSeriesData } from '@/types';

/**
 * 图表注册信息
 */
export interface ChartRegistration {
  chartId: string;
  chartInstance: any; // 使用 any 以兼容不同版本的 ECharts 类型
  data: TimeSeriesData[];
  formatOptions?: any;
  isSeriesVisible?: (seriesId: string) => boolean;
  containerElement?: HTMLElement;
}

/**
 * 鼠标位置信息
 */
export interface MousePosition {
  x: number; // 相对于图表容器的坐标
  y: number; // 相对于图表容器的坐标
  pageX: number; // 相对于页面的坐标
  pageY: number; // 相对于页面的坐标
}

/**
 * Tooltip 展示项
 */
export interface TooltipSeriesItem {
  id: string;
  label: string;
  color: string;
  value: number | string;
  formattedValue: string;
  [key: string]: any; // 支持自定义字段
}

/**
 * Tooltip 数据
 */
export interface TooltipData {
  /** 时间或 X 轴标签 */
  time: string;
  /** 系列数据列表 */
  series: TooltipSeriesItem[];
  /** 原始数据（可选，用于自定义渲染） */
  raw?: any;
}

interface TooltipState {
  /** 当前固定的 Tooltip 所属的图表 ID */
  pinnedChartId: string | null;
  /** 当前鼠标悬停的图表 ID */
  activeChartId: string | null;
  /** 全局鼠标位置（Dashboard 层面监听） */
  globalMousePosition: MousePosition | null;
  /** 当前鼠标位置（图表内部监听，已废弃，保留用于兼容） */
  mousePosition: MousePosition | null;
  /** 固定时的鼠标位置 */
  pinnedPosition: MousePosition | null;
  /** 当前 Tooltip 展示数据 */
  tooltipData: TooltipData | null;
  /** 固定时的 Tooltip 数据 */
  pinnedTooltipData: TooltipData | null;
  /** 已注册的图表 Map (使用 Map 避免响应式开销) */
  registeredCharts: Map<string, ChartRegistration>;
}

export const useTooltipStore = defineStore('tooltip', {
  state: (): TooltipState => ({
    pinnedChartId: null,
    activeChartId: null,
    globalMousePosition: null,
    mousePosition: null,
    pinnedPosition: null,
    tooltipData: null,
    pinnedTooltipData: null,
    registeredCharts: new Map(),
  }),

  getters: {
    /**
     * 检查指定图表的 Tooltip 是否被固定
     */
    isChartPinned: (state) => (chartId: string) => {
      return state.pinnedChartId === chartId;
    },

    /**
     * 是否有任何 Tooltip 被固定
     */
    hasAnyPinned(): boolean {
      return this.pinnedChartId !== null;
    },

    /**
     * 获取当前活跃的图表 ID（固定优先，否则是鼠标悬停的）
     */
    currentChartId(): string | null {
      return this.pinnedChartId || this.activeChartId;
    },

    /**
     * 获取当前使用的鼠标位置（固定优先，否则使用全局位置）
     */
    currentPosition(): MousePosition | null {
      return this.pinnedPosition || this.globalMousePosition;
    },

    /**
     * 获取当前使用的 Tooltip 数据（固定优先）
     */
    currentTooltipData(): TooltipData | null {
      return this.pinnedTooltipData || this.tooltipData;
    },
  },

  actions: {
    /**
     * 更新全局鼠标位置（由 Dashboard 调用）
     */
    updateGlobalMousePosition(position: MousePosition) {
      this.globalMousePosition = position;
    },

    /**
     * 设置活跃图表（由图表的 mousemove 事件调用）
     */
    setActiveChart(chartId: string) {
      // 如果有固定的 tooltip，且不是当前固定的图表，则不更新
      if (this.pinnedChartId && this.pinnedChartId !== chartId) {
        return;
      }
      this.activeChartId = chartId;
    },

    /**
     * 注册图表到 tooltip 系统
     */
    registerChart(registration: ChartRegistration) {
      this.registeredCharts.set(registration.chartId, registration);
    },

    /**
     * 更新已注册图表的信息
     */
    updateChartRegistration(chartId: string, updates: Partial<ChartRegistration>) {
      const existing = this.registeredCharts.get(chartId);
      if (existing) {
        this.registeredCharts.set(chartId, { ...existing, ...updates } as ChartRegistration);
      }
    },

    /**
     * 取消注册图表
     */
    unregisterChart(chartId: string) {
      this.registeredCharts.delete(chartId);
      if (this.activeChartId === chartId) {
        this.activeChartId = null;
        this.mousePosition = null;
      }
      if (this.pinnedChartId === chartId) {
        this.unpinTooltip();
      }
    },

    /**
     * 获取指定图表的注册信息
     */
    getChartRegistration(chartId: string): ChartRegistration | undefined {
      return this.registeredCharts.get(chartId);
    },

    /**
     * 获取当前活跃的图表注册信息
     */
    getActiveChartRegistration(): ChartRegistration | undefined {
      const chartId = this.currentChartId;
      return chartId ? this.registeredCharts.get(chartId) : undefined;
    },

    /**
     * 更新鼠标位置和 Tooltip 数据（由图表组件调用）
     */
    updateMousePosition(chartId: string, position: MousePosition) {
      // 如果有固定的 tooltip，且不是当前固定的图表，则不更新
      if (this.pinnedChartId && this.pinnedChartId !== chartId) {
        return;
      }

      this.activeChartId = chartId;
      this.mousePosition = position;
    },

    /**
     * 更新 Tooltip 展示数据（由图表组件调用）
     */
    updateTooltipData(chartId: string, data: TooltipData | null, position?: MousePosition) {
      // 如果有固定的 tooltip，且不是当前固定的图表，则不更新
      if (this.pinnedChartId && this.pinnedChartId !== chartId) {
        return;
      }

      this.activeChartId = chartId;
      this.tooltipData = data;

      if (position) {
        this.mousePosition = position;
      }
    },

    /**
     * 鼠标离开图表（由图表组件调用）
     */
    handleMouseLeave(chartId: string) {
      // 只有当离开的是当前活跃图表时才清除
      if (this.activeChartId === chartId && !this.pinnedChartId) {
        this.activeChartId = null;
        this.mousePosition = null;
        this.tooltipData = null;
      }
    },

    /**
     * 固定指定图表的 Tooltip
     */
    pinTooltip(chartId: string, position?: MousePosition, data?: TooltipData) {
      this.pinnedChartId = chartId;
      this.pinnedPosition = position || this.mousePosition;
      this.pinnedTooltipData = data || this.tooltipData;
    },

    /**
     * 取消固定
     */
    unpinTooltip() {
      this.pinnedChartId = null;
      this.pinnedPosition = null;
      this.pinnedTooltipData = null;
    },

    /**
     * 切换固定状态
     */
    togglePin(chartId: string, position?: MousePosition) {
      if (this.pinnedChartId === chartId) {
        this.unpinTooltip();
      } else {
        this.pinTooltip(chartId, position);
      }
    },

    /**
     * 清空所有状态（用于组件卸载）
     */
    reset() {
      this.pinnedChartId = null;
      this.activeChartId = null;
      this.globalMousePosition = null;
      this.mousePosition = null;
      this.pinnedPosition = null;
      this.tooltipData = null;
      this.pinnedTooltipData = null;
      this.registeredCharts.clear();
    },
  },
});
