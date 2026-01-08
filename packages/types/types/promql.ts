/**
 * PromQL Query Builder 类型定义
 * 参考 Grafana 的实现进行简化
 */

// 标签过滤器
export interface LabelFilter {
  label: string;
  op: '=' | '!=' | '=~' | '!~';
  value: string;
}

// 操作参数类型
export type OperationParamValue = string | number | boolean;

// 操作定义
export interface Operation {
  id: string;
  params: OperationParamValue[];
}

// 可视化查询模型
export interface PromVisualQuery {
  metric: string;
  labels: LabelFilter[];
  operations: Operation[];
}

// 时间范围选项
export interface TimeRange {
  value: string;
  label: string;
}

// 操作定义
export interface OperationDef {
  id: string;
  name: string;
  category: OperationCategory;
  params: OperationParamDef[];
  defaultParams: OperationParamValue[];
  description?: string;
}

// 操作参数定义
export interface OperationParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: any }[];
  placeholder?: string;
  optional?: boolean;
}

// 操作分类
// @ts-ignore
export enum OperationCategory {
  RangeFunctions = 'Range Functions',
  Aggregations = 'Aggregations',
  Functions = 'Functions',
  BinaryOps = 'Binary Operations',
}

// 查询编辑器模式
// @ts-ignore
export enum QueryEditorMode {
  Builder = 'builder',
  Code = 'code',
}

// Prometheus 查询结果
export interface PrometheusQueryResult {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix' | 'vector' | 'scalar' | 'string';
    result: PrometheusDataPoint[];
  };
  error?: string;
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
