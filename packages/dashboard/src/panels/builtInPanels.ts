import type { Component } from 'vue';
import type { CorePanelType } from '@grafana-fast/types';

import TimeSeriesChart from '/#/components/Charts/TimeSeriesChart.vue';
import PieChart from '/#/components/Charts/PieChart.vue';
import BarChart from '/#/components/Charts/BarChart.vue';
import StatPanel from '/#/components/Charts/StatPanel.vue';
import TableChart from '/#/components/Charts/TableChart.vue';
import GaugeChart from '/#/components/Charts/GaugeChart.vue';
import HeatmapChart from '/#/components/Charts/HeatmapChart.vue';

import TimeSeriesChartStyles from '/#/components/PanelEditor/ChartStyles/TimeSeriesChartStyles.vue';
import BarChartStyles from '/#/components/PanelEditor/ChartStyles/BarChartStyles.vue';
import PieChartStyles from '/#/components/PanelEditor/ChartStyles/PieChartStyles.vue';
import StatPanelStyles from '/#/components/PanelEditor/ChartStyles/StatPanelStyles.vue';
import TableChartStyles from '/#/components/PanelEditor/ChartStyles/TableChartStyles.vue';
import GaugeChartStyles from '/#/components/PanelEditor/ChartStyles/GaugeChartStyles.vue';
import HeatmapChartStyles from '/#/components/PanelEditor/ChartStyles/HeatmapChartStyles.vue';

import { getDefaultTimeSeriesOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/timeSeriesDefaultOptions';
import { getDefaultBarChartOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/barChartDefaultOptions';
import { getDefaultPieChartOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/pieChartDefaultOptions';
import { getDefaultGaugeChartOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/gaugeChartDefaultOptions';
import { getDefaultStatPanelOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/statPanelDefaultOptions';
import { getDefaultTableChartOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/tableChartDefaultOptions';
import { getDefaultHeatmapChartOptions } from '/#/components/PanelEditor/ChartStylesDefaultOptions/heatmapChartDefaultOptions';

export interface BuiltInPanelDefinition {
  type: CorePanelType;
  label: string;
  component: Component;
  styleComponent?: Component;
  getDefaultOptions?: () => any;
}

export const BUILTIN_PANELS: BuiltInPanelDefinition[] = [
  {
    type: 'timeseries',
    label: '时间序列图',
    component: TimeSeriesChart,
    styleComponent: TimeSeriesChartStyles,
    getDefaultOptions: getDefaultTimeSeriesOptions,
  },
  {
    type: 'bar',
    label: '柱状图',
    component: BarChart,
    styleComponent: BarChartStyles,
    getDefaultOptions: getDefaultBarChartOptions,
  },
  {
    type: 'pie',
    label: '饼图',
    component: PieChart,
    styleComponent: PieChartStyles,
    getDefaultOptions: getDefaultPieChartOptions,
  },
  {
    type: 'stat',
    label: '统计值',
    component: StatPanel,
    styleComponent: StatPanelStyles,
    getDefaultOptions: getDefaultStatPanelOptions,
  },
  {
    type: 'table',
    label: '表格',
    component: TableChart,
    styleComponent: TableChartStyles,
    getDefaultOptions: getDefaultTableChartOptions,
  },
  {
    type: 'gauge',
    label: '仪表盘',
    component: GaugeChart,
    styleComponent: GaugeChartStyles,
    getDefaultOptions: getDefaultGaugeChartOptions,
  },
  {
    type: 'heatmap',
    label: '热力图',
    component: HeatmapChart,
    styleComponent: HeatmapChartStyles,
    getDefaultOptions: getDefaultHeatmapChartOptions,
  },
];

const byType = new Map<CorePanelType, BuiltInPanelDefinition>(BUILTIN_PANELS.map((p) => [p.type, p]));

export function listBuiltInPanelTypes(): CorePanelType[] {
  return BUILTIN_PANELS.map((p) => p.type);
}

export function isBuiltInPanelType(type: unknown): type is CorePanelType {
  return typeof type === 'string' && byType.has(type as CorePanelType);
}

export function getBuiltInPanelTypeOptions(): Array<{ label: string; value: CorePanelType }> {
  return BUILTIN_PANELS.map((p) => ({ label: p.label, value: p.type }));
}

export function getBuiltInPanelLabel(type: unknown): string | null {
  if (!isBuiltInPanelType(type)) return null;
  return byType.get(type)?.label ?? null;
}

export function getBuiltInPanelComponent(type: unknown): Component | null {
  if (!isBuiltInPanelType(type)) return null;
  return byType.get(type)?.component ?? null;
}

export function getBuiltInPanelStyleComponent(type: unknown): Component | null {
  if (!isBuiltInPanelType(type)) return null;
  return byType.get(type)?.styleComponent ?? null;
}

export function getBuiltInPanelDefaultOptions(type: unknown): any {
  if (!isBuiltInPanelType(type)) return {};
  const fn = byType.get(type)?.getDefaultOptions;
  if (!fn) return {};
  try {
    return fn();
  } catch {
    return {};
  }
}
