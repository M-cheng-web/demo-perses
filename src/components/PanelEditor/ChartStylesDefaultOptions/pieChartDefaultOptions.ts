/**
 * 饼图默认配置
 */
export interface PieChartOptions {
  legend: {
    show: boolean;
    position: 'bottom' | 'right';
    mode: 'list' | 'table';
    values: string[];
  };
  specific: {
    pieType: 'pie' | 'doughnut';
    innerRadius: number;
    showPercentage: boolean;
  };
  format: {
    unit: string;
    decimals: 'default' | number;
  };
  chart: {
    colors: string[];
  };
}

/**
 * 获取饼图默认配置
 */
export const getDefaultPieChartOptions = (): PieChartOptions => ({
  legend: {
    show: true,
    position: 'bottom',
    mode: 'list',
    values: [],
  },
  specific: {
    pieType: 'pie',
    innerRadius: 40,
    showPercentage: true,
  },
  format: {
    unit: 'none',
    decimals: 'default',
  },
  chart: {
    colors: [],
  },
});
