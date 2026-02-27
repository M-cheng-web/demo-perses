/**
 * PromQL 渲染回归检查（轻量脚本）
 *
 * 说明：为什么使用脚本（而不是完整测试框架）？
 * - 保持仓库轻量：避免额外测试框架依赖
 * - 为关键渲染行为提供确定性的安全网
 *
 * 运行：
 * - `pnpm -C packages/utils run test:promql`
 */

import assert from 'node:assert/strict';
import { PromQueryModeller } from '../src/promql/PromQueryModeller';
import { PromOperationId } from '../src/promql/types';
import type { PromVisualQuery, PromVisualQueryBinary } from '../src/promql/types';

function test(name: string, fn: () => void) {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`✓ ${name}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`✗ ${name}`);
    throw err;
  }
}

const modeller = new PromQueryModeller();

test('label values are quoted + escaped', () => {
  const q: PromVisualQuery = {
    metric: 'up',
    labels: [{ label: 'job', op: '=', value: 'a"b\\c\n' }],
    operations: [],
  };
  const rendered = modeller.renderQuery(q);
  assert.equal(rendered, 'up{job="a\\"b\\\\c\\n"}');
});

test('label_join renderer quotes string params', () => {
  const q: PromVisualQuery = {
    metric: 'm',
    labels: [],
    operations: [{ id: PromOperationId.LabelJoin, params: ['dst', '-', 'src1', 'src2'] }],
  };
  const rendered = modeller.renderQuery(q);
  assert.equal(rendered, 'label_join(m, "dst", "-", "src1", "src2")');
});

test('aggregation-with-param WITHOUT uses without(...) (not by)', () => {
  const q: PromVisualQuery = {
    metric: 'm',
    labels: [],
    operations: [{ id: '__topk_without', params: [5, 'job'] }],
  };
  const rendered = modeller.renderQuery(q);
  assert.equal(rendered, 'topk without(job)(5, m)');
});

test('vector matching renders stable output', () => {
  const q: PromVisualQuery = {
    metric: 'a',
    labels: [],
    operations: [],
    binaryQueries: [
      {
        operator: '+',
        vectorMatching: { type: 'on', labels: ['foo', 'bar'] },
        query: { metric: 'b', labels: [], operations: [] },
      } satisfies PromVisualQueryBinary,
    ],
  };
  const rendered = modeller.renderQuery(q);
  assert.equal(rendered, 'a + on(foo, bar) b');
});

test('vector matching uses structured field (preferred)', () => {
  const q: PromVisualQuery = {
    metric: 'a',
    labels: [],
    operations: [],
    binaryQueries: [
      {
        operator: '+',
        vectorMatching: { type: 'ignoring', labels: ['foo', ' bar ', ''] },
        query: { metric: 'b', labels: [], operations: [] },
      } satisfies PromVisualQueryBinary,
    ],
  };
  const rendered = modeller.renderQuery(q);
  assert.equal(rendered, 'a + ignoring(foo, bar) b');
});

test('unknown operationId throws (strict by default)', () => {
  const q: PromVisualQuery = {
    metric: 'up',
    labels: [],
    operations: [{ id: 'unknown_op', params: [] }],
  };
  assert.throws(() => modeller.renderQuery(q));
});
