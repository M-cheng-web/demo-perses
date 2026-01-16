/**
 * 时间处理工具函数
 */

import type { TimeRange, AbsoluteTimeRange, Timestamp } from '@grafana-fast/types';

function isValidTimestamp(ts: number): boolean {
  return Number.isFinite(ts) && !Number.isNaN(ts);
}

function parseDateLikeToTimestamp(value: string): Timestamp {
  // 说明：
  // - dayjs 之前会“尽量解析”一些非标准格式；现在我们严格依赖浏览器/JS 引擎的 Date.parse 行为
  // - 建议外部只传 ISO8601 或者 `now-1h` 这类相对语法
  const ts = Date.parse(value);
  return isValidTimestamp(ts) ? ts : Date.now();
}

function pad(num: number, len = 2): string {
  return String(num).padStart(len, '0');
}

/**
 * 格式化 Date（支持常用 token）
 *
 * 支持 token：
 * - YYYY MM DD HH mm ss SSS
 *
 * 注意：
 * - 这里只实现项目当前用到的格式化能力（避免引入 dayjs）
 * - 默认使用本地时区（与 dayjs 默认行为一致）
 */
function formatDate(date: Date, format: string): string {
  const replacements: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    SSS: pad(date.getMilliseconds(), 3),
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (token) => replacements[token] ?? token);
}

/**
 * 解析相对时间字符串（如 "now-1h"）
 */
export function parseRelativeTime(relativeTime: string): Timestamp {
  const now = Date.now();

  if (relativeTime === 'now') {
    return now;
  }

  // 解析格式: now-1h, now-30m, now-7d 等
  const match = relativeTime.match(/^now-(\d+)([smhdwMy])$/);
  if (!match) {
    return now;
  }

  const value = parseInt(match[1] || '0', 10);
  const unit = match[2] || 'h';

  // 固定毫秒单位：秒/分/时/天/周
  const msMap: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  if (unit in msMap) {
    return now - value * (msMap[unit] ?? 0);
  }

  // 月/年：使用 Date 的 setMonth/setFullYear 处理（避免纯毫秒造成月长度差异问题）
  const d = new Date(now);
  if (unit === 'M') {
    d.setMonth(d.getMonth() - value);
    return d.getTime();
  }
  if (unit === 'y') {
    d.setFullYear(d.getFullYear() - value);
    return d.getTime();
  }

  return now;
}

/**
 * 解析时间范围为绝对时间
 */
export function parseTimeRange(timeRange: TimeRange): AbsoluteTimeRange {
  let from: Timestamp;
  let to: Timestamp;

  // 处理 from
  if (typeof timeRange.from === 'string') {
    if (timeRange.from.startsWith('now')) {
      from = parseRelativeTime(timeRange.from);
    } else {
      from = parseDateLikeToTimestamp(timeRange.from);
    }
  } else {
    from = timeRange.from;
  }

  // 处理 to
  if (typeof timeRange.to === 'string') {
    if (timeRange.to.startsWith('now')) {
      to = parseRelativeTime(timeRange.to);
    } else {
      to = parseDateLikeToTimestamp(timeRange.to);
    }
  } else {
    to = timeRange.to;
  }

  return { from, to };
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: Timestamp, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(Number(timestamp));
  if (!isValidTimestamp(date.getTime())) return '';
  return formatDate(date, format);
}

/**
 * 格式化时间（formatTime 别名）
 */
export function formatTime(timestamp: Timestamp, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return formatTimestamp(timestamp, format);
}

/**
 * 计算时间范围的持续时间（毫秒）
 */
export function getTimeRangeDuration(timeRange: AbsoluteTimeRange): number {
  return timeRange.to - timeRange.from;
}

/**
 * 计算建议的步长（毫秒）
 */
export function calculateSuggestedStep(timeRange: AbsoluteTimeRange, points: number = 100): number {
  const duration = getTimeRangeDuration(timeRange);
  return Math.max(1000, Math.floor(duration / points)); // 至少 1 秒
}

/**
 * 格式化持续时间
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天`;
  } else if (hours > 0) {
    return `${hours}小时`;
  } else if (minutes > 0) {
    return `${minutes}分钟`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 获取快捷时间范围选项
 */
export function getQuickTimeRangeOptions() {
  return [
    { label: '最近 5 分钟', value: 'now-5m', range: { value: 5, unit: 'minutes' as const } },
    { label: '最近 15 分钟', value: 'now-15m', range: { value: 15, unit: 'minutes' as const } },
    { label: '最近 30 分钟', value: 'now-30m', range: { value: 30, unit: 'minutes' as const } },
    { label: '最近 1 小时', value: 'now-1h', range: { value: 1, unit: 'hours' as const } },
    { label: '最近 3 小时', value: 'now-3h', range: { value: 3, unit: 'hours' as const } },
    { label: '最近 6 小时', value: 'now-6h', range: { value: 6, unit: 'hours' as const } },
    { label: '最近 12 小时', value: 'now-12h', range: { value: 12, unit: 'hours' as const } },
    { label: '最近 24 小时', value: 'now-24h', range: { value: 24, unit: 'hours' as const } },
    { label: '最近 7 天', value: 'now-7d', range: { value: 7, unit: 'days' as const } },
    { label: '最近 30 天', value: 'now-30d', range: { value: 30, unit: 'days' as const } },
  ];
}

/**
 * 获取刷新间隔选项
 */
export function getRefreshIntervalOptions() {
  return [
    { label: '关闭', value: 0 },
    { label: '每 5 秒', value: 5000 },
    { label: '每 10 秒', value: 10000 },
    { label: '每 30 秒', value: 30000 },
    { label: '每 1 分钟', value: 60000 },
    { label: '每 5 分钟', value: 300000 },
    { label: '每 15 分钟', value: 900000 },
  ];
}
