/**
 * 面板组相关类型定义
 */

import type { ID } from './common';
import type { Panel } from './panel';
import type { PanelLayout } from './layout';

/**
 * 面板组定义
 */
export interface PanelGroup {
  /** 面板组 ID */
  id: ID;
  /** 面板组标题 */
  title: string;
  /** 面板组描述 */
  description?: string;
  /** 是否折叠 */
  isCollapsed: boolean;
  /** 排序顺序 */
  order: number;
  /** 面板列表 */
  panels: Panel[];
  /** 布局配置 */
  layout: PanelLayout[];
}

/**
 * 面板组创建参数
 */
export interface CreatePanelGroupParams {
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
}

/**
 * 面板组更新参数
 */
export interface UpdatePanelGroupParams {
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 是否折叠 */
  isCollapsed?: boolean;
}
