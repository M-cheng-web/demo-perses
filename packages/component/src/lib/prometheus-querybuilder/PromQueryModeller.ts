/**
 * @fileoverview PromQL 查询建模器主类
 * @description
 *   查询建模器的主要实现类，管理所有操作定义。
 *       主要功能：
 *       - 注册所有操作定义到操作注册表
 *       - 按类别分类操作（Aggregations, Range Functions, Functions 等）
 *       - 提供操作查询接口
 *       - renderQuery: 将 PromVisualQuery 渲染为 PromQL 字符串
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/PromQueryModeller.ts
 */
/**
 * Prometheus 查询建模器
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/PromQueryModeller.ts
 */
import { getAggregationOperations } from './aggregations';
import { getOperationDefinitions } from './operations';
import { PromQueryModellerBase } from './shared/PromQueryModellerBase';
import type { PromQueryPattern, PromQueryModellerInterface } from './types';
import { PromQueryPatternType, PromVisualQueryOperationCategory } from './types';

export class PromQueryModeller extends PromQueryModellerBase implements PromQueryModellerInterface {
  constructor() {
    super(() => {
      return [...getOperationDefinitions(), ...getAggregationOperations()];
    });

    this.setOperationCategories([
      PromVisualQueryOperationCategory.Aggregations,
      PromVisualQueryOperationCategory.RangeFunctions,
      PromVisualQueryOperationCategory.Functions,
      PromVisualQueryOperationCategory.Time,
      PromVisualQueryOperationCategory.BinaryOps,
      PromVisualQueryOperationCategory.Trigonometric,
    ]);
  }

  getQueryPatterns(): PromQueryPattern[] {
    return [
      // Rate 查询模板
      {
        name: 'Rate then sum',
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
      },
      {
        name: 'Rate then sum by(label)',
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: [''] },
        ],
      },
      {
        name: 'Rate then sum by(label) then avg',
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: [''] },
          { id: 'avg', params: [] },
        ],
      },
      {
        name: 'Increase',
        type: PromQueryPatternType.Rate,
        operations: [{ id: 'increase', params: ['$__rate_interval'] }],
      },
      {
        name: 'Irate then sum',
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'irate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
      },
      // Histogram 查询模板
      {
        name: 'Histogram quantile on rate',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
      {
        name: 'Histogram quantile on increase',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'increase', params: ['$__rate_interval'] },
          { id: '__max_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
      {
        name: 'Histogram P99',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.99] },
        ],
      },
      {
        name: 'Histogram P50 (Median)',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.5] },
        ],
      },
      // Binary 二元运算模板
      {
        name: 'Error Rate (errors / total)',
        type: PromQueryPatternType.Binary,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: '',
              labels: [],
              operations: [
                { id: 'rate', params: ['$__rate_interval'] },
                { id: 'sum', params: [] },
              ],
            },
          },
        ],
      },
      {
        name: 'Percentage calculation',
        type: PromQueryPatternType.Binary,
        operations: [{ id: 'sum', params: [] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: '',
              labels: [],
              operations: [{ id: 'sum', params: [] }],
              binaryQueries: [
                {
                  operator: '*',
                  vectorMatches: '100',
                  query: {
                    metric: '',
                    labels: [],
                    operations: [],
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
            query: {
              metric: '',
              labels: [],
              operations: [],
            },
          },
        ],
      },
    ];
  }
}

// 导出单例
export const promQueryModeller = new PromQueryModeller();
