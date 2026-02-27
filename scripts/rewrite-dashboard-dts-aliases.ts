/**
 * 重写 dashboard 声明文件：移除内部 `/#/` 别名引用。
 *
 * 背景：
 * - Dashboard 源码使用 Vite 别名 `/#/` 指向 `packages/dashboard/src`。
 * - `vue-tsc --emitDeclarationOnly` 会保留 import specifier，导致生成的 `dist/*.d.ts`
 *   仍然包含 `from '/#/...'`。
 * - `/#/` 不是一个真实的包路径，会影响下游 TypeScript 消费者（例如 `@grafana-fast/hook`）。
 *
 * 本脚本会基于 `packages/dashboard/dist` 内 `.d.ts` 文件的相对位置，把 `'/#/foo/bar'`
 * 改写为相对路径（例如 `'../foo/bar'`）。
 */

import consola from 'consola';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import { rootDir } from './utils.js';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function computeRelative(fromDirPosix: string, targetPosix: string): string {
  const rel = path.posix.relative(fromDirPosix, targetPosix);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function main() {
  const distRoot = path.join(rootDir, 'packages/dashboard/dist');
  if (!(await fs.pathExists(distRoot))) {
    consola.warn(`未找到 dashboard dist，跳过重写：${distRoot}`);
    return;
  }

  const files = await fg(['**/*.d.ts'], { cwd: distRoot, absolute: true, dot: true });
  if (files.length === 0) {
    consola.warn(`在该目录下未找到 .d.ts 文件：${distRoot}`);
    return;
  }

  let changedCount = 0;
  for (const absFile of files) {
    const relFile = toPosix(path.relative(distRoot, absFile));
    const fileDir = path.posix.dirname(relFile);
    const fromDir = fileDir === '.' ? '' : fileDir;

    const original = await fs.readFile(absFile, 'utf8');
    let next = original;

    next = next.replace(/(['"])\/#\/([^'"]+)\1/g, (_m, quote: string, target: string) => {
      const targetPosix = String(target);
      const rel = computeRelative(fromDir, targetPosix);
      return `${quote}${rel}${quote}`;
    });

    if (next !== original) {
      await fs.writeFile(absFile, next);
      changedCount += 1;
    }
  }

  consola.success(`dashboard d.ts 别名重写完成：已更新 ${changedCount}/${files.length} 个文件`);
}

main().catch((err) => {
  consola.error(err);
  process.exit(1);
});
