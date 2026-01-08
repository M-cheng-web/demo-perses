/**
 * 图表相关类型定义
 */

/**
 * 图表选项
 */
export interface ChartOptions {
  /** 线条样式 */
  line?: LineStyleOptions;
  /** 填充样式 */
  area?: AreaStyleOptions;
  /** 堆叠配置 */
  stack?: string;
  /** 颜色配置 */
  colors?: string[];
  /** 平滑曲线 */
  smooth?: boolean;
  /** 显示数据点 */
  showSymbol?: boolean;
}

/**
 * 线条样式选项
 */
export interface LineStyleOptions {
  /** 线宽（px） */
  width?: number;
  /** 线型 */
  type?: LineType;
}

/**
 * 线型
 */
export type LineType = 'solid' | 'dashed' | 'dotted';

/**
 * 填充样式选项
 */
export interface AreaStyleOptions {
  /** 透明度 0-1 */
  opacity?: number;
  /** 填充颜色 */
  color?: string;
}

/**
 * 坐标轴选项
 */
export interface AxisOptions {
  /** X 轴配置 */
  xAxis?: XAxisOptions;
  /** Y 轴配置 */
  yAxis?: YAxisOptions;
}

/**
 * X 轴选项
 */
export interface XAxisOptions {
  /** 是否显示 */
  show?: boolean;
  /** 轴名称 */
  name?: string;
  /** 轴类型 */
  type?: AxisType;
  /** 分割线 */
  splitLine?: SplitLineOptions;
}

/**
 * Y 轴选项
 */
export interface YAxisOptions {
  /** 是否显示 */
  show?: boolean;
  /** 轴名称 */
  name?: string;
  /** 最小值 */
  min?: number | 'dataMin';
  /** 最大值 */
  max?: number | 'dataMax';
  /** 分割线 */
  splitLine?: SplitLineOptions;
}

/**
 * 轴类型
 */
export type AxisType = 'category' | 'value' | 'time' | 'log';

/**
 * 分割线选项
 */
export interface SplitLineOptions {
  /** 是否显示 */
  show?: boolean;
  /** 线条样式 */
  lineStyle?: LineStyleOptions;
}

/**
 * 图例选项
 */
export interface LegendOptions {
  /** 是否显示 */
  show?: boolean;
  /** 位置 */
  position?: LegendPosition;
  /** 方向 */
  orient?: LegendOrient;
}

/**
 * 图例位置
 */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * 图例方向
 */
export type LegendOrient = 'horizontal' | 'vertical';

/**
 * 格式化选项
 */
export interface FormatOptions {
  /** 单位 */
  unit?: UnitType;
  /** 小数位数 */
  decimals?: number;
  /** 使用千分位分隔符 */
  useThousandsSeparator?: boolean;
}

/**
 * 单位类型
 */
export type UnitType = 'none' | 'percent' | 'bytes' | 'KB' | 'MB' | 'GB' | 'TB' | 'ms' | 's' | 'min' | 'h' | 'ops' | 'reqps' | 'custom';

/**
 * 面板标题选项
 */
export interface PanelTitleOptions {
  /** 显示标题 */
  show?: boolean;
  /** 字体大小 */
  fontSize?: number;
  /** 字体粗细 */
  fontWeight?: 'normal' | 'bold';
  /** 文本颜色 */
  color?: string;
}

/**
 * 阈值配置
 */
export interface ThresholdConfig {
  /** 值 */
  value: number;
  /** 颜色 */
  color: string;
  /** 标签 */
  label?: string;
}

/**
 * 颜色方案
 */
export type ColorScheme = 'default' | 'cool' | 'warm' | 'classic' | 'green' | 'blue' | 'red' | 'purple';
