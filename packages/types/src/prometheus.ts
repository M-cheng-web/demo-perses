/**
 * Prometheus 数据源类型定义
 */

// ==================== 查询相关 ====================

// Prometheus 查询结果
export interface PrometheusQueryResult {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix' | 'vector' | 'scalar' | 'string';
    result: PrometheusDataPoint[];
  };
  error?: string;
  errorType?: string;
}

// Prometheus 数据点
export interface PrometheusDataPoint {
  metric: Record<string, string>;
  values?: [number, string][]; // matrix 类型
  value?: [number, string]; // vector 类型
}

// 通用数据点（解析后的格式）
export interface DataPoint {
  timestamp: number;
  value: number;
}

// 时间序列
export interface TimeSeries {
  name: string;
  labels: string;
  data: DataPoint[];
}

// ==================== 指标相关 ====================

// 指标元数据
export interface MetricMetadata {
  type: 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped';
  help: string;
  unit?: string;
}

// 指标名称和元数据
export interface MetricItem {
  name: string;
  type?: string;
  help?: string;
}

// ==================== 标签相关 ====================

// 标签值响应
export interface LabelValuesResponse {
  status: 'success' | 'error';
  data: string[];
}

// 标签名称响应
export interface LabelNamesResponse {
  status: 'success' | 'error';
  data: string[];
}

// ==================== 序列相关 ====================

// 序列标签
export interface SeriesLabels {
  [key: string]: string;
}

// 序列响应
export interface SeriesResponse {
  status: 'success' | 'error';
  data: SeriesLabels[];
}

// ==================== 数据源配置 ====================

// Prometheus 数据源配置
export interface PrometheusDatasource {
  id: string;
  name: string;
  type: 'prometheus';
  url: string;
  access?: 'proxy' | 'direct';
  basicAuth?: boolean;
  withCredentials?: boolean;
  isDefault?: boolean;
  jsonData?: {
    timeInterval?: string;
    queryTimeout?: string;
    httpMethod?: 'POST' | 'GET';
    customQueryParameters?: string;
  };
}

// ==================== 查询提示相关 ====================

// 查询提示类型
export const QueryHintType = {
  APPLY_RATE: 'APPLY_RATE',
  APPLY_HISTOGRAM_QUANTILE: 'APPLY_HISTOGRAM_QUANTILE',
  CONSIDER_RATE: 'CONSIDER_RATE',
  ADD_RATE_BEFORE_AGGREGATION: 'ADD_RATE_BEFORE_AGGREGATION',
  EXPAND_RANGE_INTERVAL: 'EXPAND_RANGE_INTERVAL',
} as const;
export type QueryHintType = (typeof QueryHintType)[keyof typeof QueryHintType];

// 查询提示
export interface QueryHint {
  type: QueryHintType;
  label: string;
  fix?: {
    label: string;
    action: () => void;
  };
}
