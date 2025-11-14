/**
 * Legend 相关类型定义
 */

export type LegendMode = 'list' | 'table' | 'compact';
export type LegendPosition = 'bottom' | 'right';
export type LegendSize = 'small' | 'medium';

export interface LegendOptions {
  show?: boolean;
  mode?: LegendMode;
  position?: LegendPosition;
  size?: LegendSize;
  values?: LegendValue[];
}

export type LegendValue = 'mean' | 'first' | 'last' | 'min' | 'max' | 'sum';

export interface LegendItem {
  id: string;
  label: string;
  color: string;
  data?: Record<string, unknown>;
  visible?: boolean;
}

export type LegendSelection = 'ALL' | Record<string, boolean>;

