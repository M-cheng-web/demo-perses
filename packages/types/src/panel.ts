/**
 * 面板相关类型定义
 */

import type { ID } from './common';
import type { CanonicalQuery } from './query';
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
  queries: CanonicalQuery[];
  /** 面板选项 */
  options: PanelOptions;
  /**
   * 数据变换链（可选）
   * - 用于 stat/gauge/table 等场景把 time-series 数据转换为最终展示形态
   * - 也可用于重命名、过滤、聚合等
   */
  transformations?: PanelTransformation[];
}

/**
 * 面板类型
 */
export type PanelType = string;

/**
 * 内置面板类型（Core）
 *
 * 说明：
 * - 这些类型由仓库内置的 panels 子包提供实现
 * - 插件化后，外部面板也可以注册任意 `PanelType`（字符串）
 */
export type CorePanelType = 'timeseries' | 'pie' | 'bar' | 'table' | 'stat' | 'gauge' | 'heatmap';

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
    /** 阈值模式：absolute（绝对值）/ percent（百分比） */
    mode: 'absolute' | 'percent';
    steps: Array<{
      /** 阶段名称（可选，用于 UI 展示） */
      name: string;
      /**
       * 阈值值
       * - number：该阶段起始值
       * - null：表示“无阈值/起点”，常用于第一段（例如从 -∞ 开始）
       */
      value: number | null;
      /** 阶段颜色（用于渲染区间颜色/文字颜色等） */
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

export interface PanelTransformation {
  /**
   * transformation 标识
   *
   * 说明：
   * - 一般对应“变换插件”的类型名，例如 'reduce' / 'rename' / 'merge' 等
   * - 具体能力由 transformations registry 或内置实现决定
   */
  id: string;
  /**
   * transformation 配置
   *
   * 说明：
   * - 每种 transformation 的 options 结构不同
   * - 存储层保持宽松：未知字段不丢失，便于未来扩展与兼容旧 JSON
   */
  options?: Record<string, any>;
}
