/**
 * 时间范围类型定义
 */

import type { Timestamp } from './common';

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间（ISO string 或时间戳） */
  from: string | Timestamp;
  /** 结束时间（ISO string 或时间戳） */
  to: string | Timestamp;
}

/**
 * 绝对时间范围（时间戳）
 */
export interface AbsoluteTimeRange {
  /** 开始时间戳（毫秒） */
  from: Timestamp;
  /** 结束时间戳（毫秒） */
  to: Timestamp;
}

/**
 * 相对时间范围
 */
export interface RelativeTimeRange {
  /** 时间值 */
  value: number;
  /** 时间单位 */
  unit: TimeUnit;
}

/**
 * 时间单位
 */
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

/**
 * 快捷时间范围选项
 */
export interface QuickTimeRangeOption {
  /** 标签 */
  label: string;
  /** 值 */
  value: string;
  /** 时间范围 */
  range: RelativeTimeRange;
}

/**
 * 刷新间隔（毫秒）
 */
export type RefreshInterval = number;

/**
 * 刷新间隔选项
 */
export interface RefreshIntervalOption {
  /** 标签 */
  label: string;
  /** 值（毫秒，0 表示关闭） */
  value: RefreshInterval;
}
