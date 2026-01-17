import consola from 'consola';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import { rootDir } from './utils.js';
import { packages as metaPackages } from '../meta/packages.js';

const targets = [
  ...metaPackages.map((pkg) => `packages/${pkg.name}/dist`),
  // TypeScript incremental artifacts (composite projects):
  // - dist 目录被清理后，如果 tsbuildinfo 仍在，某些情况下会导致 d.ts 未重新生成（增量状态不一致）
  ...metaPackages.map((pkg) => `packages/${pkg.name}/*.tsbuildinfo`),
  'packages/docs/.vitepress/dist',
  'packages/docs/.vitepress/cache',
];

async function main() {
  const matches = await fg(targets, {
    cwd: rootDir,
    onlyFiles: false,
    dot: true,
    unique: true,
  });

  if (matches.length === 0) {
    consola.info('没有可清理的内容');
    return;
  }

  for (const rel of matches) {
    const abs = path.join(rootDir, rel);
    await fs.remove(abs);
    consola.success(`已删除 ${rel}`);
  }
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
