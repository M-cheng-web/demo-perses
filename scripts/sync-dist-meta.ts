import consola from 'consola';
import { packages, copyMeta, readRootVersion } from './utils.js';

async function main() {
  const version = await readRootVersion();

  consola.start('同步 dist 元信息（package.json/README）');
  for (const pkg of packages) {
    await copyMeta(pkg, version);
  }
  consola.success('dist 元信息同步完成');
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
