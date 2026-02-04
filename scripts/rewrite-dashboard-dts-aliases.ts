/**
 * Rewrite dashboard declaration files to remove the internal `/#/` alias.
 *
 * Background:
 * - Dashboard source code uses Vite alias `/#/` to represent `packages/dashboard/src`.
 * - `vue-tsc --emitDeclarationOnly` preserves the original import specifiers, so the emitted
 *   `dist/*.d.ts` would contain `from '/#/...'`.
 * - That breaks downstream TypeScript consumers (e.g. `@grafana-fast/hooks`) because `/#/`
 *   is not a real package path outside of the dashboard build setup.
 *
 * This script rewrites `'/#/foo/bar'` -> relative path (e.g. `'../foo/bar'`) based on
 * the current `.d.ts` file location inside `packages/dashboard/dist`.
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
    consola.warn(`dashboard dist not found, skip rewrite: ${distRoot}`);
    return;
  }

  const files = await fg(['**/*.d.ts'], { cwd: distRoot, absolute: true, dot: true });
  if (files.length === 0) {
    consola.warn(`no .d.ts files found under: ${distRoot}`);
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

  consola.success(`dashboard d.ts alias rewrite complete: ${changedCount}/${files.length} files updated`);
}

main().catch((err) => {
  consola.error(err);
  process.exit(1);
});
