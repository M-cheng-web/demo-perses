/**
 * 仪表盘默认配置
 */
export interface GaugeChartOptions {
  format: {
    unit: string;
    decimals: 'default' | number;
    shortValues: boolean;
  };
  thresholds: {
    mode: 'absolute' | 'percent';
    steps: Array<{
      name: string;
      value: number | null;
      color: string;
    }>;
    showLegend: boolean;
  };
  specific: {
    calculation: 'last' | 'first' | 'mean' | 'min' | 'max';
    max: number;
  };
}

/**
 * 获取仪表盘默认配置
 */
export const getDefaultGaugeChartOptions = (): GaugeChartOptions => ({
  format: {
    unit: 'percent',
    decimals: 1,
    shortValues: false,
  },
  thresholds: {
    mode: 'percent',
    steps: [
      { name: 'T2', value: 25, color: '#f5222d' },
      { name: 'T1', value: 10, color: '#faad14' },
      { name: 'Default', value: null, color: '#52c41a' },
    ],
    showLegend: true,
  },
  specific: {
    calculation: 'last',
    max: 100,
  },
});
