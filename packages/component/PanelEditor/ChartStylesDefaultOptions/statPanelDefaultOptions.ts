/**
 * 统计面板默认配置
 */
export interface StatPanelOptions {
  specific: {
    displayMode: 'value-only' | 'value-and-name';
    orientation: 'vertical' | 'horizontal';
    textAlign: 'left' | 'center' | 'right';
    showTrend: boolean;
  };
  format: {
    unit: string;
    decimals: 'default' | number;
  };
}

/**
 * 获取统计面板默认配置
 */
export const getDefaultStatPanelOptions = (): StatPanelOptions => ({
  specific: {
    displayMode: 'value-only',
    orientation: 'vertical',
    textAlign: 'center',
    showTrend: false,
  },
  format: {
    unit: 'none',
    decimals: 'default',
  },
});
