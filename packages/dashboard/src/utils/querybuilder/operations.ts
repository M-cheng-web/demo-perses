/**
 * PromQL 操作定义
 * 参考 Grafana 核心操作
 */
import { OperationCategory } from '@grafana-fast/types/promql';
import type { OperationDef } from '@grafana-fast/types/promql';

// Range Functions（范围函数）
export const rangeFunctionOperations: OperationDef[] = [
  {
    id: 'rate',
    name: 'rate',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
          { label: '30m', value: '30m' },
          { label: '1h', value: '1h' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间序列的每秒平均增长率',
  },
  {
    id: 'irate',
    name: 'irate',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算瞬时增长率（基于最后两个数据点）',
  },
  {
    id: 'increase',
    name: 'increase',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
          { label: '1h', value: '1h' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间范围内的增长量',
  },
  {
    id: 'avg_over_time',
    name: 'avg_over_time',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
          { label: '1h', value: '1h' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间范围内的平均值',
  },
  {
    id: 'sum_over_time',
    name: 'sum_over_time',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间范围内的总和',
  },
  {
    id: 'max_over_time',
    name: 'max_over_time',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间范围内的最大值',
  },
  {
    id: 'min_over_time',
    name: 'min_over_time',
    category: OperationCategory.RangeFunctions,
    params: [
      {
        name: 'range',
        type: 'select',
        options: [
          { label: '1m', value: '1m' },
          { label: '5m', value: '5m' },
          { label: '10m', value: '10m' },
        ],
        placeholder: '选择时间范围',
      },
    ],
    defaultParams: ['5m'],
    description: '计算时间范围内的最小值',
  },
];

// Aggregations（聚合操作）
export const aggregationOperations: OperationDef[] = [
  {
    id: 'sum',
    name: 'sum',
    category: OperationCategory.Aggregations,
    params: [],
    defaultParams: [],
    description: '对所有时间序列求和',
  },
  {
    id: 'sum_by',
    name: 'sum by',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'labels',
        type: 'string',
        placeholder: '输入标签名，多个用逗号分隔',
      },
    ],
    defaultParams: [''],
    description: '按指定标签分组求和',
  },
  {
    id: 'avg',
    name: 'avg',
    category: OperationCategory.Aggregations,
    params: [],
    defaultParams: [],
    description: '计算所有时间序列的平均值',
  },
  {
    id: 'avg_by',
    name: 'avg by',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'labels',
        type: 'string',
        placeholder: '输入标签名，多个用逗号分隔',
      },
    ],
    defaultParams: [''],
    description: '按指定标签分组计算平均值',
  },
  {
    id: 'max',
    name: 'max',
    category: OperationCategory.Aggregations,
    params: [],
    defaultParams: [],
    description: '选择最大值',
  },
  {
    id: 'max_by',
    name: 'max by',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'labels',
        type: 'string',
        placeholder: '输入标签名，多个用逗号分隔',
      },
    ],
    defaultParams: [''],
    description: '按指定标签分组选择最大值',
  },
  {
    id: 'min',
    name: 'min',
    category: OperationCategory.Aggregations,
    params: [],
    defaultParams: [],
    description: '选择最小值',
  },
  {
    id: 'min_by',
    name: 'min by',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'labels',
        type: 'string',
        placeholder: '输入标签名，多个用逗号分隔',
      },
    ],
    defaultParams: [''],
    description: '按指定标签分组选择最小值',
  },
  {
    id: 'count',
    name: 'count',
    category: OperationCategory.Aggregations,
    params: [],
    defaultParams: [],
    description: '计算时间序列数量',
  },
  {
    id: 'topk',
    name: 'topk',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'k',
        type: 'number',
        placeholder: '输入数量',
      },
    ],
    defaultParams: [5],
    description: '返回前 K 个最大值',
  },
  {
    id: 'bottomk',
    name: 'bottomk',
    category: OperationCategory.Aggregations,
    params: [
      {
        name: 'k',
        type: 'number',
        placeholder: '输入数量',
      },
    ],
    defaultParams: [5],
    description: '返回前 K 个最小值',
  },
];

// Functions（通用函数）
export const functionOperations: OperationDef[] = [
  {
    id: 'abs',
    name: 'abs',
    category: OperationCategory.Functions,
    params: [],
    defaultParams: [],
    description: '返回绝对值',
  },
  {
    id: 'ceil',
    name: 'ceil',
    category: OperationCategory.Functions,
    params: [],
    defaultParams: [],
    description: '向上取整',
  },
  {
    id: 'floor',
    name: 'floor',
    category: OperationCategory.Functions,
    params: [],
    defaultParams: [],
    description: '向下取整',
  },
  {
    id: 'round',
    name: 'round',
    category: OperationCategory.Functions,
    params: [
      {
        name: 'to_nearest',
        type: 'number',
        placeholder: '取整精度（可选）',
        optional: true,
      },
    ],
    defaultParams: [],
    description: '四舍五入',
  },
  {
    id: 'clamp_max',
    name: 'clamp_max',
    category: OperationCategory.Functions,
    params: [
      {
        name: 'max',
        type: 'number',
        placeholder: '最大值',
      },
    ],
    defaultParams: [100],
    description: '限制最大值',
  },
  {
    id: 'clamp_min',
    name: 'clamp_min',
    category: OperationCategory.Functions,
    params: [
      {
        name: 'min',
        type: 'number',
        placeholder: '最小值',
      },
    ],
    defaultParams: [0],
    description: '限制最小值',
  },
];

// 获取所有操作
export function getAllOperations(): OperationDef[] {
  return [...rangeFunctionOperations, ...aggregationOperations, ...functionOperations];
}

// 根据分类获取操作
export function getOperationsByCategory(category: OperationCategory): OperationDef[] {
  return getAllOperations().filter((op) => op.category === category);
}

// 根据 ID 获取操作定义
export function getOperationById(id: string): OperationDef | undefined {
  return getAllOperations().find((op) => op.id === id);
}
