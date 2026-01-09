/**
 * @fileoverview 查询建模器抽象基类
 * @description
 *   查询建模器的抽象基类，定义通用接口。
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus-querybuilder/shared/PromQueryModellerBase.ts
 */
/**
 * Prometheus 查询建模器基类
 * 参考 Grafana: packages/grafana-prometheus/src/querybuilder/shared/PromQueryModellerBase.ts
 */
import { renderLabels } from './rendering/labels';
import { hasBinaryOp, renderOperations } from './rendering/operations';
import { renderQuery, renderBinaryQueries } from './rendering/query';
import type {
  PrometheusVisualQuery,
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  VisualQueryBinary,
  VisualQueryModeller,
} from './types';

export abstract class PromQueryModellerBase implements VisualQueryModeller {
  protected operationsRegistry: Map<string, QueryBuilderOperationDef> = new Map();
  private categories: string[] = [];
  private operationsMapCache: Map<string, QueryBuilderOperationDef> | null = null;

  constructor(getOperations: () => QueryBuilderOperationDef[]) {
    const operations = getOperations();
    operations.forEach((op) => {
      this.operationsRegistry.set(op.id, op);
    });
  }

  private getOperationsMap(): Map<string, QueryBuilderOperationDef> {
    if (!this.operationsMapCache) {
      this.operationsMapCache = new Map<string, QueryBuilderOperationDef>();
      this.operationsRegistry.forEach((op, key) => {
        this.operationsMapCache!.set(key, op);
      });
    }
    return this.operationsMapCache;
  }

  protected setOperationCategories(categories: string[]) {
    this.categories = categories;
  }

  getOperationsForCategory(category: string): QueryBuilderOperationDef[] {
    return Array.from(this.operationsRegistry.values()).filter((op) => op.category === category && !op.hideFromList);
  }

  getAlternativeOperations(key: string): QueryBuilderOperationDef[] {
    return Array.from(this.operationsRegistry.values()).filter((op) => op.alternativesKey && op.alternativesKey === key);
  }

  getCategories(): string[] {
    return this.categories;
  }

  getOperationDef(id: string): QueryBuilderOperationDef | undefined {
    return this.operationsRegistry.get(id);
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]): string {
    return renderOperations(queryString, operations, this.getOperationsMap());
  }

  renderBinaryQueries(queryString: string, binaryQueries?: Array<VisualQueryBinary<PrometheusVisualQuery>>): string {
    return renderBinaryQueries(queryString, binaryQueries);
  }

  renderLabels(labels: QueryBuilderLabelFilter[]): string {
    return renderLabels(labels);
  }

  renderQuery(query: PrometheusVisualQuery, nested?: boolean): string {
    return renderQuery(query, nested, this.getOperationsMap());
  }

  hasBinaryOp(query: PrometheusVisualQuery): boolean {
    return hasBinaryOp(query, this.getOperationsMap());
  }
}
