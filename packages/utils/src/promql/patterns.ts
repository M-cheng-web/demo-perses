/**
 * PromQL QueryBuilder：Query Patterns（常用模板）
 *
 * 说明：
 * - patterns 用于快速生成常见 PromQL 结构（rate/直方图/binary 等）
 * - metric 通常由用户在 UI 中补充，因此模板里会保持 metric 为空字符串
 */

import type { PromQueryPattern } from './types';
import { PromOperationId, PromQueryPatternType } from './types';
import { aggById } from './ids';
import type { PromVisualQuery } from './types';

function emptyQuery(): PromVisualQuery {
  return { metric: '', labels: [], operations: [] };
}

export function getPromQueryPatterns(): PromQueryPattern[] {
  return [
    // ----------------------------
    // Rate
    // ----------------------------
    {
      name: 'Rate then sum',
      type: PromQueryPatternType.Rate,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: PromOperationId.Sum, params: [] },
      ],
    },
    {
      name: 'Rate then sum by(label)',
      type: PromQueryPatternType.Rate,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Sum), params: [''] },
      ],
    },
    {
      name: 'Rate then sum by(label) then avg',
      type: PromQueryPatternType.Rate,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Sum), params: [''] },
        { id: PromOperationId.Avg, params: [] },
      ],
    },
    {
      name: 'Increase',
      type: PromQueryPatternType.Rate,
      operations: [{ id: PromOperationId.Increase, params: ['$__rate_interval'] }],
    },
    {
      name: 'Irate then sum',
      type: PromQueryPatternType.Rate,
      operations: [
        { id: PromOperationId.Irate, params: ['$__rate_interval'] },
        { id: PromOperationId.Sum, params: [] },
      ],
    },

    // ----------------------------
    // Histogram
    // ----------------------------
    {
      name: 'Histogram quantile on rate',
      type: PromQueryPatternType.Histogram,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Sum), params: ['le'] },
        { id: PromOperationId.HistogramQuantile, params: [0.95] },
      ],
    },
    {
      name: 'Histogram quantile on increase',
      type: PromQueryPatternType.Histogram,
      operations: [
        { id: PromOperationId.Increase, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Max), params: ['le'] },
        { id: PromOperationId.HistogramQuantile, params: [0.95] },
      ],
    },
    {
      name: 'Histogram P99',
      type: PromQueryPatternType.Histogram,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Sum), params: ['le'] },
        { id: PromOperationId.HistogramQuantile, params: [0.99] },
      ],
    },
    {
      name: 'Histogram P50 (Median)',
      type: PromQueryPatternType.Histogram,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: aggById(PromOperationId.Sum), params: ['le'] },
        { id: PromOperationId.HistogramQuantile, params: [0.5] },
      ],
    },

    // ----------------------------
    // Binary
    // ----------------------------
    {
      name: 'Error Rate (errors / total)',
      type: PromQueryPatternType.Binary,
      operations: [
        { id: PromOperationId.Rate, params: ['$__rate_interval'] },
        { id: PromOperationId.Sum, params: [] },
      ],
      binaryQueries: [
        {
          operator: '/',
          query: {
            ...emptyQuery(),
            operations: [
              { id: PromOperationId.Rate, params: ['$__rate_interval'] },
              { id: PromOperationId.Sum, params: [] },
            ],
          },
        },
      ],
    },
    {
      name: 'Percentage calculation',
      type: PromQueryPatternType.Binary,
      operations: [{ id: PromOperationId.Sum, params: [] }],
      binaryQueries: [
        {
          operator: '/',
          query: {
            ...emptyQuery(),
            operations: [{ id: PromOperationId.Sum, params: [] }],
            binaryQueries: [
              {
                operator: '*',
                query: {
                  ...emptyQuery(),
                  operations: [{ id: PromOperationId.Vector, params: [100] }],
                },
              },
            ],
          },
        },
      ],
    },
    {
      name: 'Difference between metrics',
      type: PromQueryPatternType.Binary,
      operations: [],
      binaryQueries: [
        {
          operator: '-',
          query: emptyQuery(),
        },
      ],
    },
  ];
}
