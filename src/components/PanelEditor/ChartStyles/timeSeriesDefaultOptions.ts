/**
 * 时间序列图表默认配置
 */
export interface TimeSeriesOptions {
  legend: {
    show: boolean;
    position: 'bottom' | 'right';
    mode: 'list' | 'table';
    values: string[]; // 表格模式下显示的列
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
    mode: 'list', // 默认为列表模式（tag样式）
    values: [], // 表格模式下显示的列，如 ['min', 'max', 'mean', 'last', 'first']
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
