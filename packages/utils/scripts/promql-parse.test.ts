/**
 * PromQL 反解析回归测试（best-effort parser）
 *
 * Run:
 * - `pnpm -C packages/utils run test:promql-parse`
 */

import assert from 'node:assert/strict';
import { parsePromqlToVisualQuery } from '../src/promql/parsePromqlToVisualQuery';

function test(name: string, fn: () => void) {
  try {
    fn();
    // eslint-disable-next-line no-console（测试脚本允许输出）
    console.log(`✓ ${name}`);
  } catch (err) {
    // eslint-disable-next-line no-console（测试脚本允许输出）
    console.error(`✗ ${name}`);
    throw err;
  }
}

test('parses metric-only selector (exact)', () => {
  const r = parsePromqlToVisualQuery('up');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.confidence, 'exact');
  assert.equal(r.value.metric, 'up');
  assert.deepEqual(r.value.labels, []);
});

test('parses metric+labels selector (exact)', () => {
  const r = parsePromqlToVisualQuery('up{job="a",instance=~"b.+"}');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.confidence, 'exact');
  assert.equal(r.value.metric, 'up');
  assert.deepEqual(
    r.value.labels.map((l) => ({ label: l.label, op: l.op, value: l.value })),
    [
      { label: 'job', op: '=', value: 'a' },
      { label: 'instance', op: '=~', value: 'b.+' },
    ]
  );
});

test('extracts selector from complex expression (selector-only)', () => {
  const r = parsePromqlToVisualQuery('rate(up{job="a"}[5m])');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.confidence, 'exact');
  assert.equal(r.value.metric, 'up');
  assert.deepEqual(r.value.labels.map((l) => l.label), ['job']);
  assert.deepEqual(
    r.value.operations.map((o) => o.id),
    ['rate']
  );
  assert.deepEqual(r.value.operations[0]?.params, ['5m']);
});

test('parses nested operations + binary scalar (exact)', () => {
  const r = parsePromqlToVisualQuery(
    'acos(hour(histogram_quantile(0.9, avg(sum(changes(cpu_usage{instance=\"server-1\"}[$__interval])))))) + 4'
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.confidence, 'exact');
  assert.equal(r.value.metric, 'cpu_usage');
  assert.deepEqual(
    r.value.labels.map((l) => ({ label: l.label, op: l.op, value: l.value })),
    [{ label: 'instance', op: '=', value: 'server-1' }]
  );
  assert.deepEqual(
    r.value.operations.map((o) => o.id),
    ['changes', 'sum', 'avg', 'histogram_quantile', 'hour', 'acos', '__addition']
  );
  assert.deepEqual(r.value.operations.find((o) => o.id === 'histogram_quantile')?.params, [0.9]);
  assert.deepEqual(r.value.operations.find((o) => o.id === '__addition')?.params, [4]);
});

test('filters unknown single-arg wrappers (partial)', () => {
  const r = parsePromqlToVisualQuery('foo(rate(up[5m]))');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.confidence, 'partial');
  assert.equal(r.value.metric, 'up');
  assert.deepEqual(r.value.operations.map((o) => o.id), ['rate']);
  assert.ok(Array.isArray(r.warnings) && r.warnings.length > 0);
  assert.equal(r.warnings[0]?.code, 'UNKNOWN_WRAPPER');
});
