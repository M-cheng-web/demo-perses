import assert from 'node:assert/strict';
import { parsePromqlToAst } from '../dist/index.mjs';

/**
 * 说明：
 * - 这里是“core 包”的最小 smoke test：只验证 AST/diagnostics 的稳定性
 * - QueryBuilder 映射相关测试放在 promql-ast.test.mjs 中（同包内）
 */

function testOk() {
  const r = parsePromqlToAst('sum(rate(cpu_usage{instance="server-1"}[5m]))');
  assert.equal(r.ok, true);
  assert.equal(Array.isArray(r.diagnostics), true);
}

function testError() {
  const r = parsePromqlToAst('sum(rate(cpu_usage{instance="server-1"}[5m])');
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.length >= 1);
}

function testGrafanaVarDuration() {
  const r = parsePromqlToAst('rate(cpu_usage[$__interval])');
  // 这里预期是 ok（因为我们做了长度保持的变量兜底替换）
  assert.equal(r.ok, true);
}

function testEmptyIsNotError() {
  const r = parsePromqlToAst('');
  assert.equal(r.ok, true);
  assert.equal(Array.isArray(r.diagnostics), true);
  assert.equal(r.diagnostics.length, 0);
}

testOk();
testError();
testGrafanaVarDuration();
testEmptyIsNotError();
console.log('[promql-parser] ok');
