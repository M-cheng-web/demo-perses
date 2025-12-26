/**
 * 表格默认配置
 */
export interface TableChartOptions {
  specific: {
    showPagination: boolean;
    pageSize: number;
    sortable: boolean;
  };
  format: {
    unit: string;
    decimals: 'default' | number;
  };
}

/**
 * 获取表格默认配置
 */
export const getDefaultTableChartOptions = (): TableChartOptions => ({
  specific: {
    showPagination: true,
    pageSize: 10,
    sortable: true,
  },
  format: {
    unit: 'none',
    decimals: 'default',
  },
});
