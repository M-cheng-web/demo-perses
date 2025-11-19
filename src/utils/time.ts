/**
 * 时间处理工具函数
 */

import dayjs from 'dayjs';
import type { TimeRange, AbsoluteTimeRange, Timestamp } from '@/types';

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

  const unitMap: Record<string, dayjs.ManipulateType> = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
    w: 'week',
    M: 'month',
    y: 'year',
  };

  const manipulateType = unitMap[unit];
  if (!manipulateType) {
    return now;
  }

  return dayjs().subtract(value, manipulateType).valueOf();
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
      from = dayjs(timeRange.from).valueOf();
    }
  } else {
    from = timeRange.from;
  }

  // 处理 to
  if (typeof timeRange.to === 'string') {
    if (timeRange.to.startsWith('now')) {
      to = parseRelativeTime(timeRange.to);
    } else {
      to = dayjs(timeRange.to).valueOf();
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
  return dayjs(timestamp).format(format);
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
