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
  /** 内部定时器 */
  _timerId: number | null;
}

const DEFAULT_TIME_RANGE: TimeRange = {
  from: 'now-1h',
  to: 'now',
};
const DEFAULT_REFRESH_INTERVAL = 0;

export const useTimeRangeStore = defineStore('timeRange', {
  state: (): TimeRangeState => ({
    timeRange: { ...DEFAULT_TIME_RANGE },
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    _timerId: null,
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
     * 重置为默认时间范围与默认刷新间隔
     *
     * 说明：
     * - timeRange/refreshInterval 属于运行时全局 UI 状态，不应持久化到 Dashboard JSON
     * - 每次整盘 load/替换时，dashboard store 会调用该方法做“回到默认”的语义
     */
    reset() {
      this.setTimeRange({ ...DEFAULT_TIME_RANGE });
      this.setRefreshInterval(DEFAULT_REFRESH_INTERVAL);
    },

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
      this._restartAutoRefreshTimer();
    },

    /**
     * 刷新时间范围（用于相对时间）
     */
    refresh() {
      // 如果使用相对时间（如 "now"），强制更新以触发重新计算
      this.timeRange = { ...this.timeRange };
    },

    stopAutoRefresh() {
      if (this._timerId !== null) {
        clearInterval(this._timerId);
        this._timerId = null;
      }
    },

    _restartAutoRefreshTimer() {
      // private-ish action (still callable)
      this.stopAutoRefresh();
      if (!this.refreshInterval || this.refreshInterval <= 0) return;
      this._timerId = window.setInterval(() => {
        this.refresh();
      }, this.refreshInterval);
    },
  },
});
