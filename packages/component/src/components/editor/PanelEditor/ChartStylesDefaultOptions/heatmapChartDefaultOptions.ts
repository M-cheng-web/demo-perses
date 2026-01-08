/**
 * 热力图默认配置
 */
export interface HeatmapChartOptions {
  specific: {
    colorScheme: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
    showValue: boolean;
    minColor: string;
    maxColor: string;
  };
  format: {
    unit: string;
    decimals: 'default' | number;
  };
}

/**
 * 获取热力图默认配置
 */
export const getDefaultHeatmapChartOptions = (): HeatmapChartOptions => ({
  specific: {
    colorScheme: 'blue',
    showValue: false,
    minColor: '',
    maxColor: '',
  },
  format: {
    unit: 'none',
    decimals: 'default',
  },
});
