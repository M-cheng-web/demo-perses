/**
 * @fileoverview 查询构建器统一导出入口
 * @description
 *   统一导出查询构建器的所有公共类型和函数。
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/index.ts
 */
/**
 * Prometheus Query Builder 主入口
 * 导出所有公共 API
 */

// 核心类
export { PromQueryModeller, promQueryModeller } from './PromQueryModeller';

// 类型定义
export type { PromVisualQuery, PromVisualQueryBinary, PromQueryPattern, PromQueryModellerInterface } from './types';

export type {
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  QueryWithOperations,
  VisualQueryModeller,
  VisualQueryBinary,
} from './shared/types';

export { PromOperationId, PromVisualQueryOperationCategory, PromQueryPatternType } from './types';

// 工具函数
export { getAggregationOperations } from './aggregations';
export { getOperationDefinitions } from './operations';
