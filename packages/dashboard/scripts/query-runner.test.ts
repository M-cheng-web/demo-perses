import assert from 'node:assert/strict';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import type { CanonicalQuery, QueryContext, QueryResult } from '@grafana-fast/types';
import { QueryRunner } from '../src/query/queryRunner';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    // eslint-disable-next-line no-console -- test script output is allowed
    console.log(`✓ ${name}`);
  } catch (error) {
    // eslint-disable-next-line no-console -- test script output is allowed
    console.error(`✗ ${name}`);
    throw error;
  }
}

const baseContext: QueryContext = {
  timeRange: { from: 1_700_000_000_000, to: 1_700_000_060_000 },
};

const makeQuery = (id: string, refId: string, expr: string): CanonicalQuery => ({
  id,
  refId,
  datasourceRef: { type: 'prometheus', uid: 'mock' },
  expr,
  format: 'time_series',
  instant: false,
  hide: false,
});

const toResult = (query: CanonicalQuery): QueryResult => ({
  queryId: query.id,
  refId: query.refId,
  expr: query.expr,
  data: [],
});

function createAbortError(): Error {
  const error = new Error('aborted');
  Object.defineProperty(error, 'name', { value: 'AbortError', configurable: true });
  return error;
}

function createApiClient(
  executeQueries: (queries: CanonicalQuery[], context: QueryContext, options?: { signal?: AbortSignal }) => Promise<QueryResult[]>
): GrafanaFastApiClient {
  return {
    kind: 'mock',
    dashboard: {} as never,
    datasource: {} as never,
    variable: {} as never,
    query: {
      executeQueries,
      fetchMetrics: async () => [],
      fetchLabelKeys: async () => [],
      fetchLabelValues: async () => [],
    },
  } as unknown as GrafanaFastApiClient;
}

await test('dedupes identical in-flight queries', async () => {
  let callCount = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });

  const api = createApiClient(async (queries) => {
    callCount++;
    await gate;
    return queries.map((q) => toResult(q));
  });

  const runner = new QueryRunner(api, { maxConcurrency: 4, cacheTtlMs: 1_000 });
  const query = makeQuery('q-1', 'A', 'up');

  const first = runner.executeQueries([query], baseContext);
  await sleep(0);
  const second = runner.executeQueries([query], baseContext);

  assert.equal(callCount, 1);
  release();

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult[0]?.expr, 'up');
  assert.equal(secondResult[0]?.expr, 'up');
});

await test('respects maxConcurrency when executing panel queries', async () => {
  let inflight = 0;
  let peakInflight = 0;
  let callCount = 0;

  const api = createApiClient(async (queries) => {
    callCount++;
    inflight++;
    peakInflight = Math.max(peakInflight, inflight);
    await sleep(30);
    inflight--;
    return queries.map((q) => toResult(q));
  });

  const runner = new QueryRunner(api, { maxConcurrency: 2, cacheTtlMs: 0 });
  const queries = [
    makeQuery('q-1', 'A', 'up'),
    makeQuery('q-2', 'B', 'up{job="a"}'),
    makeQuery('q-3', 'C', 'up{job="b"}'),
    makeQuery('q-4', 'D', 'up{job="c"}'),
  ];

  const results = await runner.executeQueries(queries, baseContext);
  assert.equal(results.length, 4);
  assert.equal(callCount, 4);
  assert.ok(peakInflight <= 2, `expected peakInflight <= 2, got ${peakInflight}`);
});

await test('propagates abort and does not reuse aborted cache entries', async () => {
  let callCount = 0;
  const api = createApiClient((queries, _context, options) => {
    callCount++;
    const signal = options?.signal;
    return new Promise<QueryResult[]>((resolve, reject) => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const timer = setTimeout(() => {
        resolve(queries.map((q) => toResult(q)));
      }, 80);

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(createAbortError());
        },
        { once: true }
      );
    });
  });

  const runner = new QueryRunner(api, { maxConcurrency: 4, cacheTtlMs: 1_000 });
  const query = makeQuery('q-1', 'A', 'up');

  const controller = new AbortController();
  const aborted = runner.executeQueries([query], baseContext, { signal: controller.signal });
  await sleep(0);
  controller.abort();

  await assert.rejects(aborted, (error: unknown) => {
    return error instanceof Error && error.name === 'AbortError';
  });

  const next = await runner.executeQueries([query], baseContext);
  assert.equal(next[0]?.error, undefined);
  assert.equal(callCount, 2);
});

await test('reuses cached result before TTL and refreshes after TTL', async () => {
  let callCount = 0;
  const api = createApiClient(async (queries) => {
    callCount++;
    return queries.map((q) => toResult(q));
  });

  const runner = new QueryRunner(api, { maxConcurrency: 4, cacheTtlMs: 40 });
  const query = makeQuery('q-1', 'A', 'up');

  await runner.executeQueries([query], baseContext);
  await runner.executeQueries([query], baseContext);
  assert.equal(callCount, 1);

  await sleep(60);
  await runner.executeQueries([query], baseContext);
  assert.equal(callCount, 2);
});
