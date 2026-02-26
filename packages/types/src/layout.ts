/**
 * 布局相关类型定义
 */

import type { ID } from './common';

/**
 * 面板布局（用于 vue-grid-layout）
 */
export interface PanelLayout {
  /** 布局项 ID（对应 panel id） */
  i: ID;
  /** X 坐标（网格单位） */
  x: number;
  /** Y 坐标（网格单位） */
  y: number;
  /** 宽度（网格单位） */
  w: number;
  /** 高度（网格单位） */
  h: number;
  /** 最小宽度（前端网格约束，UI 内部使用；后端契约仅要求 i/x/y/w/h） */
  minW?: number;
  /** 最小高度（前端网格约束，UI 内部使用；后端契约仅要求 i/x/y/w/h） */
  minH?: number;
  /** 最大宽度（前端网格约束，UI 内部使用；后端契约仅要求 i/x/y/w/h） */
  maxW?: number;
  /** 最大高度（前端网格约束，UI 内部使用；后端契约仅要求 i/x/y/w/h） */
  maxH?: number;
  /** 是否静态（不可拖拽和调整；前端网格约束，UI 内部使用；后端契约仅要求 i/x/y/w/h） */
  static?: boolean;
}

/**
 * 网格布局配置
 */
export interface GridLayoutConfig {
  /** 列数 */
  colNum: number;
  /** 行高（px） */
  rowHeight: number;
  /** 间距（px） */
  margin: number | [number, number];
  /** 是否可拖拽 */
  isDraggable: boolean;
  /** 是否可调整大小 */
  isResizable: boolean;
  /** 是否垂直压缩 */
  verticalCompact: boolean;
  /** 使用 CSS transforms */
  useCssTransforms: boolean;
}

/**
 * 默认网格布局配置
 */
export const DEFAULT_GRID_CONFIG: GridLayoutConfig = {
  colNum: 48,
  rowHeight: 30,
  margin: 10,
  isDraggable: true,
  isResizable: true,
  verticalCompact: true,
  useCssTransforms: true,
};
