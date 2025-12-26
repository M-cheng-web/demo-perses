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
  };
  specific: {
    calculation: 'last' | 'first' | 'mean' | 'min' | 'max';
    min: number;
    max: number;
    startAngle: number;
    endAngle: number;
    splitNumber: number;
    pointer: {
      show: boolean;
      length: string;
      width: number;
    };
  };
}

/**
 * 获取仪表盘默认配置
 */
export const getDefaultGaugeChartOptions = (): GaugeChartOptions => ({
  format: {
    unit: 'none',
    decimals: 1,
    shortValues: false,
  },
  thresholds: {
    mode: 'percent',
    steps: [
      { name: '正常', value: 0, color: '#52c41a' },
      { name: '警告', value: 60, color: '#faad14' },
      { name: '严重', value: 80, color: '#ff4d4f' },
    ],
  },
  specific: {
    calculation: 'last',
    min: 0,
    max: 100,
    startAngle: 225,
    endAngle: -45,
    splitNumber: 10,
    pointer: {
      show: true,
      length: '60%',
      width: 8,
    },
  },
});
