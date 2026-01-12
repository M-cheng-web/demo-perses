import consola from 'consola';
import { packages, copyMeta, run, readRootVersion } from './utils.js';

async function main() {
  const version = await readRootVersion();

  consola.start('清理产物目录');
  run('nr clean');

  consola.start('构建 shared types');
  run('pnpm -C packages/types run build');

  consola.start('构建 store 包');
  run('pnpm -C packages/store run build');

  consola.start('构建 UI component 包');
  run('pnpm -C packages/component run build');
  run('pnpm -C packages/component run build:types');

  consola.start('构建 dashboard 包');
  run('pnpm -C packages/dashboard run build');
  run('pnpm -C packages/dashboard run build:types');

  consola.start('构建 hooks 包');
  run('pnpm -C packages/hook run build');

  consola.start('同步 dist 元信息（package.json/README）');
  for (const pkg of packages) {
    await copyMeta(pkg, version);
  }

  consola.success('打包流水线完成');
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
