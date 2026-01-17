/**
 * ECharts Theme 工具（弱类型版本）
 *
 * 设计说明：
 * - 该模块用于生成 ECharts 的基础主题配置（palette/text/tooltip 等）
 * - 为了避免 @grafana-fast/utils 引入 `echarts` 依赖，这里使用“弱类型”返回（EChartsOptionLike）
 * - dashboard / app 等真正使用 echarts 的地方，可以把返回值直接透传给 echarts 实例
 */

import { readCssVar, type CssVarName } from '../dom/cssVar';

export interface EChartsOptionLike {
  color?: string[];
  textStyle?: {
    color?: string;
  };
  tooltip?: Record<string, unknown>;
}

export interface EChartsTheme {
  palette: string[];
  text: string;
  textSecondary: string;
  borderMuted: string;
  border: string;
  surface: string;
  baseOption: Pick<EChartsOptionLike, 'color' | 'textStyle' | 'tooltip'>;
}

const FALLBACK = {
  palette: ['#356fcf', '#3f7bd9', '#2c5fb0', '#5d8fbf', '#6d85ad', '#4b6f9f', '#2f466f', '#8ea6c8'],
  text: '#0f182a',
  textSecondary: 'rgba(15, 24, 42, 0.62)',
  borderMuted: 'rgba(31, 74, 148, 0.12)',
  border: 'rgba(31, 74, 148, 0.22)',
  tooltipBg: 'rgba(15, 24, 42, 0.92)',
  tooltipText: '#f5f8ff',
  surface: '#ffffff',
};

/**
 * 获取 ECharts 调色板（优先从 CSS Var 读取）
 */
export function getEChartsPalette(target?: HTMLElement | null): string[] {
  const palette = Array.from({ length: 8 }, (_, idx) => readCssVar(target, `--gf-chart-${idx + 1}` as CssVarName, FALLBACK.palette[idx]!));
  return palette.filter(Boolean);
}

/**
 * 获取 ECharts Theme（便捷入口）
 */
export function getEChartsTheme(target?: HTMLElement | null): EChartsTheme {
  return getEChartsThemeForTarget(target);
}

/**
 * 获取 ECharts Theme（可显式指定 target）
 */
export function getEChartsThemeForTarget(target?: HTMLElement | null): EChartsTheme {
  const palette = getEChartsPalette(target);
  const text = readCssVar(target, '--gf-color-text', FALLBACK.text);
  const textSecondary = readCssVar(target, '--gf-color-text-tertiary', FALLBACK.textSecondary);
  const borderMuted = readCssVar(target, '--gf-color-border-muted', FALLBACK.borderMuted);
  const border = readCssVar(target, '--gf-color-border', FALLBACK.border);
  const tooltipBg = readCssVar(target, '--gf-color-tooltip-bg', FALLBACK.tooltipBg);
  const tooltipText = readCssVar(target, '--gf-color-tooltip-text', FALLBACK.tooltipText);
  const surface = readCssVar(target, '--gf-color-surface', FALLBACK.surface);

  return {
    palette,
    text,
    textSecondary,
    borderMuted,
    border,
    surface,
    baseOption: {
      color: palette,
      textStyle: {
        color: text,
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: border,
        borderWidth: 1,
        textStyle: {
          color: tooltipText,
        },
        extraCssText: `box-shadow: ${readCssVar(target, '--gf-shadow-1', 'none')}; border-radius: ${readCssVar(target, '--gf-radius-md', '4px')};`,
      },
    },
  };
}
