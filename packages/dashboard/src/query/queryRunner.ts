/**
 * QueryRunner（单次执行层）
 *
 * 这是 “调度器（QueryScheduler）” 之下的执行器：
 * - 负责把 CanonicalQuery + QueryContext 变成 QueryResult[]
 * - 负责并发控制、缓存、in-flight 去重（同一 key 的重复请求复用同一个 Promise）
 * - 负责取消（AbortSignal）
 *
 * 设计原则：
 * - QueryRunner 不关心 UI（面板布局/组件），只专注“如何稳定执行查询”
 * - 具体请求如何发出由 @grafana-fast/api 的实现层决定（mock/http）
 */
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import type { CanonicalQuery, QueryContext, QueryResult } from '@grafana-fast/types';

export interface QueryRunnerOptions {
  /**
   * 最大并发数（默认 6）
   * - 防止一个 dashboard 里大量 panel 同时刷新导致请求风暴
   */
  maxConcurrency?: number;
  /**
   * 缓存 TTL（毫秒）
   * - 0 表示禁用缓存
   * - 对 “now” 类相对时间的 dashboard，建议 TTL 较短（避免误用过期数据）
   */
  cacheTtlMs?: number;
  /**
   * 缓存最大条目数（默认 500）
   *
   * 说明：
   * - QueryRunner 的 cache 是一个 Map；如果不做上限，长时间运行（尤其是自动刷新/频繁切换 timeRange）
   *   会出现“只增不减”的内存风险。
   * - 该上限同时约束 result 与 in-flight promise 条目；超过上限会按 LRU（最久未使用）淘汰。
   */
  maxCacheEntries?: number;
}

interface CacheEntry {
  timestamp: number;
  promise?: Promise<QueryResult>;
  result?: QueryResult;
}

const toErrorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && value != null) {
    const msg = (value as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return stableStringify(value);
};

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class QueryRunner {
  private api: GrafanaFastApiClient;
  private options: Required<QueryRunnerOptions>;
  private cache = new Map<string, CacheEntry>();
  private inflight = 0;
  private queue: Array<() => void> = [];
  private lastPruneAt = 0;

  constructor(api: GrafanaFastApiClient, options: QueryRunnerOptions = {}) {
    this.api = api;
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 6,
      cacheTtlMs: options.cacheTtlMs ?? 5_000,
      maxCacheEntries: options.maxCacheEntries ?? 500,
    };
  }

  private touchCacheKey(key: string, entry: CacheEntry) {
    // Move to the back (most recently used) without changing TTL timestamp.
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private pruneCache(now: number) {
    // Don't prune too frequently; keep it cheap.
    if (now - this.lastPruneAt < 2_000) return;
    this.lastPruneAt = now;

    // 1) TTL prune (only for settled results; keep in-flight promises)
    if (this.options.cacheTtlMs > 0) {
      for (const [key, entry] of this.cache) {
        if (entry.promise) continue;
        if (now - entry.timestamp <= this.options.cacheTtlMs) continue;
        this.cache.delete(key);
      }
    }

    // 2) Size prune (LRU via Map insertion order)
    const max = this.options.maxCacheEntries;
    while (this.cache.size > max) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  private createAbortError(): Error {
    const err = new Error('Aborted');
    Object.defineProperty(err, 'name', { value: 'AbortError', configurable: true });
    return err;
  }

  private isAbortError(err: unknown): boolean {
    if (err instanceof DOMException) return err.name === 'AbortError';
    if (typeof err !== 'object' || err == null) return false;
    return (err as { name?: unknown }).name === 'AbortError';
  }

  private async runWithConcurrency<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw this.createAbortError();

    if (this.inflight >= this.options.maxConcurrency) {
      const waitForSlot = new Promise<void>((resolve) => this.queue.push(resolve));
      if (!signal) {
        await waitForSlot;
      } else {
        await Promise.race([
          waitForSlot,
          new Promise<void>((_, reject) => {
            signal.addEventListener('abort', () => reject(this.createAbortError()), { once: true });
          }),
        ]);
      }
    }
    this.inflight++;
    try {
      return await task();
    } finally {
      this.inflight--;
      const next = this.queue.shift();
      next?.();
    }
  }

  private buildCacheKey(query: CanonicalQuery, context: QueryContext, expr: string): string {
    const tr = context.timeRange;
    const from = typeof tr.from === 'number' ? tr.from : String(tr.from);
    const to = typeof tr.to === 'number' ? tr.to : String(tr.to);
    return [
      query.datasourceRef?.type ?? 'unknown',
      query.datasourceRef?.uid ?? 'unknown',
      query.format ?? 'time_series',
      query.instant ? 'instant' : 'range',
      query.minStep ?? '',
      from,
      to,
      expr,
    ].join('::');
  }

  /**
   * 执行一组查询（面板通常包含 A/B/C... 多条 query）
   *
   * 内置能力：
   * - 缓存：同 datasource + timeRange + expr 的结果可复用（TTL 内）
   * - in-flight 去重：同 key 的并发请求复用同一 Promise
   * - 并发限制：控制同时飞行中的请求数量
   */
  async executeQueries(queries: CanonicalQuery[], context: QueryContext, options: { signal?: AbortSignal } = {}): Promise<QueryResult[]> {
    const visible = queries.filter((q) => !q.hide);
    const tasks = visible.map(async (q): Promise<QueryResult> => {
      if (options.signal?.aborted) throw this.createAbortError();

      const expr = q.expr;
      const cacheKey = this.buildCacheKey(q, context, expr);
      const now = Date.now();
      this.pruneCache(now);

      const cached = this.cache.get(cacheKey);
      if (cached) {
        const fresh = this.options.cacheTtlMs > 0 && now - cached.timestamp <= this.options.cacheTtlMs;
        if (fresh && cached.result) {
          this.touchCacheKey(cacheKey, cached);
          return cached.result;
        }
        if (cached.promise) {
          this.touchCacheKey(cacheKey, cached);
          return cached.promise;
        }
      }

      const promise = this.runWithConcurrency(async () => {
        const resultList = await this.api.query.executeQueries([{ ...q, expr }], context, options.signal ? { signal: options.signal } : undefined);
        const first = Array.isArray(resultList) ? resultList[0] : undefined;

        if (!first || typeof first !== 'object') {
          return {
            queryId: q.id,
            refId: q.refId,
            expr,
            data: [],
            error: '契约错误：executeQueries 返回空数组（未返回该 query 的结果）',
          };
        }

        const queryId = String((first as any)?.queryId ?? '');
        if (!queryId || queryId !== String(q.id)) {
          return {
            queryId: q.id,
            refId: q.refId,
            expr,
            data: [],
            error: `契约错误：executeQueries 返回的 queryId 不匹配（expected=${String(q.id)}, got=${queryId || '<empty>'}）`,
          };
        }

        const data = (first as any)?.data;
        if (!Array.isArray(data)) {
          return {
            queryId: q.id,
            refId: q.refId,
            expr,
            data: [],
            error: '契约错误：QueryResult.data 必须为数组',
          };
        }

        return { ...(first as QueryResult), refId: q.refId };
      }, options.signal);

      this.cache.set(cacheKey, { timestamp: now, promise });
      this.pruneCache(now);

      try {
        const result = await promise;
        this.cache.set(cacheKey, { timestamp: Date.now(), result });
        this.pruneCache(Date.now());
        return result;
      } catch (err) {
        if (this.isAbortError(err)) {
          // Abort 不应污染缓存，否则可能导致后续复用一个已取消的 promise。
          this.cache.delete(cacheKey);
          throw err;
        }
        // 写入一个短暂的“负缓存”：避免同一错误导致的高频重试（hot loop）
        const errorResult: QueryResult = {
          queryId: q.id,
          refId: q.refId,
          expr,
          data: [],
          error: toErrorMessage(err),
        };
        this.cache.set(cacheKey, { timestamp: Date.now(), result: errorResult });
        this.pruneCache(Date.now());
        return errorResult;
      }
    });

    const settled = await Promise.allSettled(tasks);
    if (options.signal?.aborted) throw this.createAbortError();

    // 任意 query 被 abort，视为这次 panel refresh 被取消（不落地结果）。
    for (const s of settled) {
      if (s.status === 'rejected' && this.isAbortError(s.reason)) {
        throw s.reason;
      }
    }

    return settled.map((s) => {
      if (s.status === 'fulfilled') return s.value;
      // 非 abort 的异常已在 task 内归一化为 QueryResult.error；这里兜底一下（理论上不会走到）
      return {
        queryId: 'unknown',
        refId: 'unknown',
        expr: '',
        data: [],
        error: toErrorMessage(s.reason),
      };
    });
  }

  invalidateAll() {
    // 清空缓存：用于“强制刷新”或“切换 datasource 后失效”
    this.cache.clear();
  }
}
