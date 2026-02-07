import type { EChartsOption } from 'echarts';
import type { QueryResult } from '@grafana-fast/types';

interface ChartThemeLike {
  textSecondary: string;
}

export const hasQuerySeriesData = (queryResults: QueryResult[] | undefined): boolean => {
  if (!Array.isArray(queryResults) || queryResults.length === 0) return false;
  return queryResults.some((result) => Array.isArray(result?.data) && result.data.length > 0);
};

export const createNoDataOption = (theme: ChartThemeLike, text = '暂无数据'): EChartsOption => ({
  title: {
    text,
    left: 'center',
    top: 'center',
    textStyle: {
      color: theme.textSecondary,
      fontSize: 14,
    },
  },
});
