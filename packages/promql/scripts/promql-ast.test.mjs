/**
 * PromQL 映射层最小回归测试：
 * - 验证典型表达式可被 AST 映射覆盖
 * - 验证输出结构满足 PromVisualQuery 预期
 */

import assert from 'node:assert/strict';
import { parsePromqlToVisualQueryAst } from '../dist/index.mjs';

function testTopk() {
  const r = parsePromqlToVisualQueryAst('topk(5, cpu_usage)');
  assert.equal(r.ok, true);
  assert.equal(r.value.metric, 'cpu_usage');
  assert.ok(Array.isArray(r.value.operations));
  assert.equal(r.value.operations?.[0]?.id, 'topk');
}

function testVectorMatching() {
  const r = parsePromqlToVisualQueryAst('a + on(instance) b');
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.value.binaryQueries));
  assert.equal(r.value.binaryQueries?.[0]?.operator, '+');
  assert.equal(r.value.binaryQueries?.[0]?.vectorMatching?.type, 'on');
  assert.deepEqual(r.value.binaryQueries?.[0]?.vectorMatching?.labels, ['instance']);
}

function testOuterFnPlusScalar() {
  // 典型场景：outer fn + scalar binary（用户经常这么写）
  const r = parsePromqlToVisualQueryAst('acos(cpu_usage) + 4');
  assert.equal(r.ok, true);
}

testTopk();
testVectorMatching();
testOuterFnPlusScalar();
console.log('[promql-ast] ok');
