/**
 * 时间范围状态管理
 */

import { defineStore } from '@grafana-fast/store';
import type { TimeRange, AbsoluteTimeRange } from '@grafana-fast/types';
import { parseTimeRange } from '/#/utils/time';

interface TimeRangeState {
  /** 时间范围 */
  timeRange: TimeRange;
  /** 刷新间隔（毫秒，0 表示不自动刷新） */
  refreshInterval: number;
}

export const useTimeRangeStore = defineStore('timeRange', {
  state: (): TimeRangeState => ({
    timeRange: {
      from: 'now-1h',
      to: 'now',
    },
    refreshInterval: 0,
  }),

  getters: {
    /**
     * 获取绝对时间范围
     */
    absoluteTimeRange(): AbsoluteTimeRange {
      return parseTimeRange(this.timeRange);
    },

    /**
     * 是否启用自动刷新
     */
    isAutoRefreshEnabled(): boolean {
      return this.refreshInterval > 0;
    },
  },

  actions: {
    /**
     * 获取时间范围的时间戳（毫秒）
     */
    getTimeRangeTimestamps(): { start: number; end: number } {
      const { from, to } = this.absoluteTimeRange;
      return { start: from, end: to };
    },

    /**
     * 设置时间范围
     */
    setTimeRange(range: TimeRange) {
      this.timeRange = range;
    },

    /**
     * 设置刷新间隔
     */
    setRefreshInterval(interval: number) {
      this.refreshInterval = interval;
    },

    /**
     * 刷新时间范围（用于相对时间）
     */
    refresh() {
      // 如果使用相对时间（如 "now"），强制更新以触发重新计算
      this.timeRange = { ...this.timeRange };
    },
  },
});
