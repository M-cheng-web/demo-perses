/**
 * 时间序列图表默认配置
 */
export interface TimeSeriesOptions {
  legend: {
    show: boolean;
    position: 'bottom' | 'top' | 'left' | 'right';
    mode: 'list' | 'table';
    size: 'small' | 'medium';
    values: string[];
  };
  axis: {
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
  chart: {
    line: {
      width: number;
      type: 'solid' | 'dashed' | 'dotted';
    };
    connectNulls: boolean;
  };
  specific: {
    mode: 'line' | 'bar';
    stackMode: 'none' | 'normal' | 'percent';
    fillOpacity: number;
  };
}

/**
 * 获取默认配置
 */
export const getDefaultTimeSeriesOptions = (): TimeSeriesOptions => ({
  legend: {
    show: true,
    position: 'bottom',
    mode: 'list',
    size: 'medium',
    values: [],
  },
  axis: {
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
    shortValues: false,
  },
  thresholds: {
    mode: 'absolute',
    steps: [{ name: 'Default', value: null, color: '#52c41a' }],
    showLegend: true,
  },
  chart: {
    line: {
      width: 2,
      type: 'solid',
    },
    connectNulls: false,
  },
  specific: {
    mode: 'line',
    stackMode: 'none',
    fillOpacity: 0.3,
  },
});
