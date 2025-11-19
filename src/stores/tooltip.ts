/**
 * Tooltip 全局状态管理
 * 用于管理多个图表之间的 Tooltip 固定状态
 */

import { defineStore } from 'pinia';

interface TooltipState {
  /** 当前固定的 Tooltip 所属的图表 ID */
  pinnedChartId: string | null;
}

export const useTooltipStore = defineStore('tooltip', {
  state: (): TooltipState => ({
    pinnedChartId: null,
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
  },

  actions: {
    /**
     * 固定指定图表的 Tooltip
     */
    pinTooltip(chartId: string) {
      this.pinnedChartId = chartId;
    },

    /**
     * 取消固定
     */
    unpinTooltip() {
      this.pinnedChartId = null;
    },

    /**
     * 切换固定状态
     */
    togglePin(chartId: string) {
      if (this.pinnedChartId === chartId) {
        this.unpinTooltip();
      } else {
        this.pinTooltip(chartId);
      }
    },
  },
});
