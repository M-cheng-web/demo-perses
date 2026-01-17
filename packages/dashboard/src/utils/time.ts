/**
 * dashboard 内部时间工具
 *
 * 说明：
 * - 实现收敛到 @grafana-fast/utils，便于跨包复用与保持行为一致
 * - 该文件仅作为 dashboard 包内部的“稳定导出路径”（/#+/utils/time）
 */

export {
  parseRelativeTime,
  parseTimeRange,
  formatTimestamp,
  formatTime,
  getTimeRangeDuration,
  calculateSuggestedStep,
  formatDuration,
  getQuickTimeRangeOptions,
  getRefreshIntervalOptions,
} from '@grafana-fast/utils';
