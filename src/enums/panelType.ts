/**
 * 面板类型枚举
 */
export enum PanelType {
  /** 时间序列图 */
  TIMESERIES = 'timeseries',
  /** 柱状图 */
  BAR = 'bar',
  /** 饼图 */
  PIE = 'pie',
  /** 统计值 */
  STAT = 'stat',
  /** 表格 */
  TABLE = 'table',
  /** 仪表盘 */
  GAUGE = 'gauge',
  /** 热力图 */
  HEATMAP = 'heatmap',
}

/**
 * 面板类型配置
 */
export const PANEL_TYPE_CONFIG = {
  [PanelType.TIMESERIES]: {
    label: '时间序列图',
    value: PanelType.TIMESERIES,
  },
  [PanelType.BAR]: {
    label: '柱状图',
    value: PanelType.BAR,
  },
  [PanelType.PIE]: {
    label: '饼图',
    value: PanelType.PIE,
  },
  [PanelType.STAT]: {
    label: '统计值',
    value: PanelType.STAT,
  },
  [PanelType.TABLE]: {
    label: '表格',
    value: PanelType.TABLE,
  },
  [PanelType.GAUGE]: {
    label: '仪表盘',
    value: PanelType.GAUGE,
  },
  [PanelType.HEATMAP]: {
    label: '热力图',
    value: PanelType.HEATMAP,
  },
} as const;

/**
 * 面板类型选项列表
 */
export const PANEL_TYPE_OPTIONS = Object.values(PANEL_TYPE_CONFIG);
