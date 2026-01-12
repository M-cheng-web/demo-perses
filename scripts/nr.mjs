#!/usr/bin/env node
import { spawnSync } from 'child_process';

function usage(code = 0) {
  // 保持精简：这是一个本地 helper，用法尽量贴近 morehook 中常见的 `nr` 习惯。
  console.log(`用法：
  nr <脚本名> [...参数]
  nr -C <目录> <脚本名> [...参数]
`);
  process.exit(code);
}

const argv = process.argv.slice(2);
if (argv.length === 0) usage(1);

let cwd;
if (argv[0] === '-C') {
  cwd = argv[1];
  if (!cwd) usage(1);
  argv.splice(0, 2);
}

const script = argv.shift();
if (!script) usage(1);

const pnpmArgs = [];
if (cwd) pnpmArgs.push('-C', cwd);
pnpmArgs.push('run', script, ...argv);

const result = spawnSync('pnpm', pnpmArgs, { stdio: 'inherit' });
if (typeof result.status === 'number') process.exit(result.status);
process.exit(1);
