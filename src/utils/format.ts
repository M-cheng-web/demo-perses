/**
 * 格式化工具函数
 */

import type { FormatOptions } from '@/types';

/**
 * 格式化数值
 */
export function formatValue(value: number, options: FormatOptions = {}): string {
  const { unit = 'none', decimals = 2, useThousandsSeparator = false } = options;

  // 处理特殊值
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  let formattedValue = value;
  let suffix = '';

  // 根据单位转换
  switch (unit) {
    case 'percent':
      suffix = '%';
      break;

    case 'bytes':
    case 'KB':
    case 'MB':
    case 'GB':
    case 'TB':
      const result = formatBytes(value, unit !== 'bytes' ? unit : undefined);
      return result;

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

  // 格式化小数位
  let formatted = formattedValue.toFixed(decimals);

  // 添加千分位分隔符
  if (useThousandsSeparator) {
    formatted = addThousandsSeparator(parseFloat(formatted));
  }

  return `${formatted}${suffix}`;
}

/**
 * 格式化字节
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
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 缩短长文本
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}
