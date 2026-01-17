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
import { PromVisualQueryOperationCategory } from './types';
import { getPromQueryPatterns } from './patterns';

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
    return getPromQueryPatterns();
  }
}

// 导出单例
export const promQueryModeller = new PromQueryModeller();
