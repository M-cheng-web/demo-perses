/**
 * 文件说明：QueryService 契约
 *
 * 该文件定义“查询执行 + QueryBuilder 辅助能力”的统一接口。
 * 上层（QueryRunner/QueryScheduler）会基于这些方法实现并发控制、缓存、取消与调度策略。
 */
import type { CanonicalQuery, QueryContext, QueryResult, TimeRange } from '@grafana-fast/types';

/**
 * QueryService（契约层）
 *
 * 核心约束：
 * - UI/存储层使用 CanonicalQuery（统一、可迁移、可缓存的查询结构）
 * - executeQueries 的签名应尽量长期稳定：
 *   - 即便后端接口变更（字段名/结构），也优先在实现层完成兼容
 * - 取消（AbortSignal）、并发/缓存等策略属于上层（QueryRunner）/实现层能力，但契约层预留取消口子
 */
export interface ExecuteQueriesOptions {
  /**
   * 可选 AbortSignal：
   * - 由 QueryRunner/调度器在时间范围变化、刷新过期等场景触发取消
   * - 实现层应尽可能中止进行中的请求，并在信号触发后抛出 AbortError（或等价错误）
   */
  signal?: AbortSignal;
}

export interface QueryService {
  /**
   * 执行一组查询
   * - 为什么是“组”：面板通常包含多条 query（A/B/C...），实现层可合并请求/批量执行
   * - 返回 QueryResult[] 与输入 queries 对齐（至少应包含 queryId/refId 以便 UI 对齐）
   */
  executeQueries: (queries: CanonicalQuery[], context: QueryContext, options?: ExecuteQueriesOptions) => Promise<QueryResult[]>;

  /**
   * QueryBuilder 辅助能力（Prometheus-like）
   *
   * 说明：
   * - 这些方法服务于“可视化查询构建器”，属于 UI 辅助而非核心执行
   * - 仍放在 QueryService 内，是为了复用同一套 transport/caching/auth
   */
  fetchMetrics: (search?: string, options?: ExecuteQueriesOptions) => Promise<string[]>;
  fetchLabelKeys: (metric: string, options?: ExecuteQueriesOptions) => Promise<string[]>;
  fetchLabelValues: (metric: string, labelKey: string, otherLabels?: Record<string, string>, options?: ExecuteQueriesOptions) => Promise<string[]>;

  /**
   * （可选）为 query 型变量解析 options：
   * - Grafana 常见变量语义：变量 options 来自一次查询（例如 label_values）
   * - 非 Prometheus datasource 的实现层可选择忽略/抛错/返回空
   */
  fetchVariableValues?: (expr: string, timeRange: TimeRange, options?: ExecuteQueriesOptions) => Promise<Array<{ text: string; value: string }>>;
}
