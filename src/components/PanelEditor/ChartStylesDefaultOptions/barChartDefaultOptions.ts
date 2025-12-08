/**
 * 柱状图默认配置
 */
export interface BarChartOptions {
  legend: {
    show: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
  };
  specific: {
    orientation: 'vertical' | 'horizontal';
    barMode: 'group' | 'stack';
    barWidth: string;
  };
  axis: {
    xAxis: {
      show: boolean;
      name: string;
    };
    yAxis: {
      show: boolean;
      name: string;
      min?: number;
      max?: number;
    };
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
 * 获取柱状图默认配置
 */
export const getDefaultBarChartOptions = (): BarChartOptions => ({
  legend: {
    show: true,
    position: 'bottom',
  },
  specific: {
    orientation: 'vertical',
    barMode: 'group',
    barWidth: '60%',
  },
  axis: {
    xAxis: {
      show: true,
      name: '',
    },
    yAxis: {
      show: true,
      name: '',
      min: undefined,
      max: undefined,
    },
  },
  format: {
    unit: 'none',
    decimals: 'default',
  },
  chart: {
    colors: [],
  },
});
