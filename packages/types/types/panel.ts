/**
 * 面板相关类型定义
 */

import type { ID } from './common';
import type { Query } from './query';
import type { ChartOptions, AxisOptions, LegendOptions, FormatOptions, PanelTitleOptions, ThresholdConfig } from './chart';

/**
 * 面板定义
 */
export interface Panel {
  /** 面板 ID */
  id: ID;
  /** 面板名称 */
  name: string;
  /** 面板描述 */
  description?: string;
  /** 面板类型 */
  type: PanelType;
  /** 查询列表 */
  queries: Query[];
  /** 面板选项 */
  options: PanelOptions;
}

/**
 * 面板类型
 */
export type PanelType = 'timeseries' | 'pie' | 'bar' | 'table' | 'stat' | 'gauge' | 'heatmap';

/**
 * 面板选项
 */
export interface PanelOptions {
  /** 标题选项 */
  title?: PanelTitleOptions;
  /** 背景颜色 */
  background?: string;
  /** 图表选项 */
  chart?: ChartOptions;
  /** 坐标轴选项 */
  axis?: AxisOptions;
  /** 图例选项 */
  legend?: LegendOptions;
  /** 格式化选项 */
  format?: FormatOptions;
  /** 阈值配置 */
  thresholds?: {
    mode: 'absolute' | 'percent';
    steps: Array<{
      name: string;
      value: number | null;
      color: string;
    }>;
  };
  /** 特定于面板类型的选项 */
  specific?: TimeSeriesOptions | PieOptions | BarOptions | TableOptions | StatOptions | GaugeOptions | HeatmapOptions;
}

/**
 * 时间序列图特定选项
 */
export interface TimeSeriesOptions {
  /** 图表模式 */
  mode?: 'line' | 'area' | 'bar';
  /** 堆叠模式 */
  stackMode?: 'none' | 'normal' | 'percent';
  /** 填充透明度 */
  fillOpacity?: number;
}

/**
 * 饼图特定选项
 */
export interface PieOptions {
  /** 饼图类型 */
  pieType?: 'pie' | 'doughnut';
  /** 内半径（百分比，用于环形图） */
  innerRadius?: number;
  /** 显示百分比 */
  showPercentage?: boolean;
}

/**
 * 柱状图特定选项
 */
export interface BarOptions {
  /** 方向 */
  orientation?: 'vertical' | 'horizontal';
  /** 柱状图模式 */
  barMode?: 'group' | 'stack';
  /** 柱宽度 */
  barWidth?: number | string;
}

/**
 * 表格特定选项
 */
export interface TableOptions {
  /** 是否显示分页 */
  showPagination?: boolean;
  /** 每页行数 */
  pageSize?: number;
  /** 是否可排序 */
  sortable?: boolean;
  /** 列配置 */
  columns?: string[];
}

/**
 * 统计值特定选项
 */
export interface StatOptions {
  /** 显示模式 */
  displayMode?: 'value' | 'value-and-name';
  /** 方向 */
  orientation?: 'horizontal' | 'vertical';
  /** 文本对齐 */
  textAlign?: 'left' | 'center' | 'right';
  /** 显示趋势 */
  showTrend?: boolean;
  /** 阈值 */
  thresholds?: ThresholdConfig[];
}

/**
 * 仪表盘特定选项
 */
export interface GaugeOptions {
  /** 计算方式 */
  calculation?: 'last' | 'first' | 'mean' | 'min' | 'max';
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 起始角度（度） */
  startAngle?: number;
  /** 结束角度（度） */
  endAngle?: number;
  /** 刻度分割段数 */
  splitNumber?: number;
  /** 指针配置 */
  pointer?: {
    /** 是否显示指针 */
    show?: boolean;
    /** 指针长度（百分比） */
    length?: string;
    /** 指针宽度（像素） */
    width?: number;
  };
}

/**
 * 热力图特定选项
 */
export interface HeatmapOptions {
  /** 颜色方案 */
  colorScheme?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  /** 最小值颜色 */
  minColor?: string;
  /** 最大值颜色 */
  maxColor?: string;
  /** 显示值 */
  showValue?: boolean;
  /** 单元格边距 */
  cellPadding?: number;
}

/**
 * 面板尺寸
 */
export interface PanelDimensions {
  /** 宽度（像素） */
  width: number;
  /** 高度（像素） */
  height: number;
}
