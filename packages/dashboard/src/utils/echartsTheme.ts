import type { EChartsOption } from 'echarts';

type CssVarName = `--${string}`;

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

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const resolveThemeTarget = (target?: HTMLElement | null): HTMLElement => {
  if (!isBrowser()) {
    return null as unknown as HTMLElement;
  }
  if (target && target.isConnected) return target;
  return document.documentElement;
};

const readCssVar = (target: HTMLElement | null | undefined, name: CssVarName, fallback: string): string => {
  if (!isBrowser()) return fallback;
  const el = resolveThemeTarget(target);
  const value = getComputedStyle(el).getPropertyValue(name);
  return value?.trim() || fallback;
};

export function getEChartsPalette(target?: HTMLElement | null): string[] {
  const palette = Array.from({ length: 8 }, (_, idx) =>
    readCssVar(target, `--gf-chart-${idx + 1}` as CssVarName, FALLBACK.palette[idx]!)
  );
  // 过滤空值，避免 ECharts 报错
  return palette.filter(Boolean);
}

export function getEChartsTheme(target?: HTMLElement | null): {
  palette: string[];
  text: string;
  textSecondary: string;
  borderMuted: string;
  border: string;
  surface: string;
  baseOption: Pick<EChartsOption, 'color' | 'textStyle' | 'tooltip'>;
} {
  return getEChartsThemeForTarget(target);
}

export function getEChartsThemeForTarget(target?: HTMLElement | null): {
  palette: string[];
  text: string;
  textSecondary: string;
  borderMuted: string;
  border: string;
  surface: string;
  baseOption: Pick<EChartsOption, 'color' | 'textStyle' | 'tooltip'>;
} {
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
