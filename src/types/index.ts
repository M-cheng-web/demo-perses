/**
 * 类型定义统一导出
 */

export * from './common';
export * from './timeRange';
export * from './query';
export * from './chart';
export * from './panel';
export * from './layout';
export * from './panelGroup';
export * from './dashboard';
export * from './datasource';
// 导出 legend 中的类型，但排除与 chart 冲突的类型
export type { LegendMode, LegendSize, LegendValue, LegendItem, LegendSelection } from './legend';
export type { LegendOptions as LegendComponentOptions, LegendPosition as LegendComponentPosition } from './legend';
