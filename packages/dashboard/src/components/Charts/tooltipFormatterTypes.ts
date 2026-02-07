import type { DefaultLabelFormatterCallbackParams, TooltipComponentFormatterCallbackParams } from 'echarts/types/dist/option';

export type AxisTooltipFormatterParams = DefaultLabelFormatterCallbackParams[];
export type AxisTooltipFormatterParam = AxisTooltipFormatterParams[number];
export type ItemTooltipFormatterParam = DefaultLabelFormatterCallbackParams;
export type HeatmapTooltipFormatterParam = ItemTooltipFormatterParam;
export type HeatmapLabelFormatterParam = DefaultLabelFormatterCallbackParams;

export const toAxisTooltipParams = (params: TooltipComponentFormatterCallbackParams): AxisTooltipFormatterParams => {
  if (Array.isArray(params)) return params;
  return [params];
};

export const toItemTooltipParam = (params: TooltipComponentFormatterCallbackParams): ItemTooltipFormatterParam | null => {
  if (Array.isArray(params)) return params[0] ?? null;
  return params;
};

export const resolveSeriesId = (param: { seriesId?: unknown; seriesIndex?: unknown }): string => {
  if (typeof param.seriesId === 'string' && param.seriesId.length > 0) return param.seriesId;
  const index = Number(param.seriesIndex ?? 0);
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return `series-${safeIndex}`;
};

export const getAxisSeriesValue = (value: unknown): number | string => {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  const second = value[1];
  if (typeof second === 'number' || typeof second === 'string') return second;
  const first = value[0];
  if (typeof first === 'number' || typeof first === 'string') return first;
  return '';
};

export const getAxisRawValue = (param: ItemTooltipFormatterParam): unknown => {
  const maybeAxis = (param as { axisValue?: unknown }).axisValue;
  if (maybeAxis !== undefined) return maybeAxis;
  return param.value;
};

export const getAxisDisplayLabel = (param: ItemTooltipFormatterParam): string => {
  const maybeLabel = (param as { axisValueLabel?: unknown }).axisValueLabel;
  if (typeof maybeLabel === 'string' && maybeLabel.length > 0) return maybeLabel;
  if (typeof param.name === 'string' && param.name.length > 0) return param.name;
  const rawAxis = getAxisRawValue(param);
  if (typeof rawAxis === 'number' || typeof rawAxis === 'string') return String(rawAxis);
  return '';
};

export const getSeriesLabel = (param: ItemTooltipFormatterParam): string => {
  if (typeof param.seriesName === 'string' && param.seriesName.length > 0) return param.seriesName;
  if (typeof param.name === 'string' && param.name.length > 0) return param.name;
  return '';
};

export const toTooltipValue = (value: unknown): number | string => {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return normalizeNumericValue(value);
};

export const normalizeNumericValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const toCssColor = (value: unknown): string => {
  return typeof value === 'string' ? value : '#999';
};

export const getHeatmapTriplet = (data: unknown): [number, number, number] | null => {
  if (!Array.isArray(data) || data.length < 3) return null;
  const x = Number(data[0]);
  const y = Number(data[1]);
  const v = Number(data[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(v)) return null;
  return [x, y, v];
};
