/**
 * 格式化工具函数（数值/字节/文本）
 *
 * 设计目标：
 * - 提供“够用且稳定”的格式化能力，避免引入重量依赖
 * - 尽量保持可预测：对非法数值统一返回 'N/A'
 */

import type { FormatOptions } from '@grafana-fast/types';

/**
 * 格式化数值
 *
 * @param value 输入数值（必须是 number）
 * @param options 格式化选项（单位/小数位/千分位）
 * @returns 格式化后的字符串（如 "12.30%", "1.20 GB", "N/A"）
 */
export function formatValue(value: number, options: FormatOptions = {}): string {
  const { unit = 'none', decimals = 2, useThousandsSeparator = false } = options;

  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  let formattedValue = value;
  let suffix = '';

  switch (unit) {
    case 'percent':
      suffix = '%';
      break;

    case 'bytes':
    case 'KB':
    case 'MB':
    case 'GB':
    case 'TB':
      return formatBytes(value, unit !== 'bytes' ? unit : undefined);

    case 'ms':
      suffix = 'ms';
      break;

    case 's':
      suffix = 's';
      break;

    case 'min':
      formattedValue = value / 60;
      suffix = 'min';
      break;

    case 'h':
      formattedValue = value / 3600;
      suffix = 'h';
      break;

    case 'ops':
      suffix = ' ops';
      break;

    case 'reqps':
      suffix = ' req/s';
      break;

    default:
      break;
  }

  let formatted = formattedValue.toFixed(decimals);

  if (useThousandsSeparator) {
    formatted = addThousandsSeparator(parseFloat(formatted));
  }

  return `${formatted}${suffix}`;
}

/**
 * 格式化字节
 *
 * @param bytes 字节数（允许负数；会按绝对值选择单位）
 * @param targetUnit 目标单位（可选）：'KB'|'MB'|'GB'|'TB'...
 */
export function formatBytes(bytes: number, targetUnit?: string): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  if (bytes === 0) return '0 bytes';

  if (targetUnit) {
    const index = units.indexOf(targetUnit);
    if (index !== -1) {
      const value = bytes / Math.pow(1024, index);
      return `${value.toFixed(2)} ${targetUnit}`;
    }
  }

  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const index = Math.min(i, units.length - 1);

  return `${(bytes / Math.pow(k, index)).toFixed(2)} ${units[index]}`;
}

/**
 * 添加千分位分隔符
 */
export function addThousandsSeparator(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化百分比
 *
 * @param value 数值（0-100 或任意数值；不会自动 *100）
 * @param decimals 小数位（默认 1）
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 缩短长文本
 *
 * @param text 原文本
 * @param maxLength 最大长度（默认 50）
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

