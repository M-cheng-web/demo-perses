/**
 * 颜色工具函数
 */

import type { ColorScheme } from '@grafana-fast/types';

/**
 * 预定义颜色方案（用于图表系列配色）
 */
export const COLOR_SCHEMES: Record<ColorScheme, string[]> = {
  default: ['#356fcf', '#22a06b', '#f0b429', '#e4586c', '#3aa7c2', '#7b61d1', '#fc8452', '#6d85ad', '#ea7ccc'],
  cool: ['#4e79a7', '#59a14f', '#9c755f', '#f28e2b', '#edc948', '#bab0ac', '#e15759', '#b07aa1'],
  warm: ['#e15759', '#f28e2b', '#edc948', '#59a14f', '#4e79a7', '#b07aa1', '#9c755f', '#bab0ac'],
  classic: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
  green: ['#d4f1d4', '#a3d9a3', '#72c172', '#41a941', '#109110', '#0f790f', '#0d610d', '#0b490b'],
  blue: ['#cfe2ff', '#9cc5ff', '#6aa8ff', '#388bff', '#066eff', '#0558cc', '#044299', '#032c66'],
  red: ['#ffd4d4', '#ffa3a3', '#ff7272', '#ff4141', '#ff1010', '#cc0d0d', '#990a0a', '#660707'],
  purple: ['#e6d4ff', '#cca3ff', '#b372ff', '#9941ff', '#7f10ff', '#660dcc', '#4c0a99', '#330766'],
};

/**
 * 生成图表颜色数组
 *
 * @param count 颜色数量（<=0 返回空数组）
 * @param scheme 配色方案（默认 default）
 */
export function generateChartColors(count: number, scheme: ColorScheme = 'default'): string[] {
  const colors = COLOR_SCHEMES[scheme];
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    if (color) result.push(color);
  }

  return result;
}

/**
 * RGB 转 HEX
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * HEX 转 RGB
 *
 * @returns 解析失败返回 null
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * 调整颜色透明度（hex -> rgba）
 *
 * @param color hex 颜色（#RRGGBB）
 * @param alpha 透明度（0-1）
 */
export function adjustAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * 根据阈值获取颜色
 *
 * 入参说明：
 * - thresholds 会按 value 降序排序
 * - 返回第一个满足 `value >= threshold.value` 的颜色
 * - 若都不满足，返回最后一个阈值的颜色（或默认色）
 */
export function getColorByThreshold(value: number, thresholds: Array<{ value: number; color: string }>): string {
  const sorted = [...thresholds].sort((a, b) => b.value - a.value);

  for (const threshold of sorted) {
    if (value >= threshold.value) return threshold.color;
  }

  return sorted[sorted.length - 1]?.color || '#356fcf';
}
