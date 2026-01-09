import consola from 'consola';
import { packages, copyMeta, run } from './utils.js';
import { version } from '../package.json';

async function main() {
  consola.start('Building shared types');
  run('pnpm -C packages/types run build');

  consola.start('Building component package');
  run('pnpm -C packages/component run build');
  run('pnpm -C packages/component run build:types');

  consola.start('Building hooks package');
  run('pnpm -C packages/hook run build');

  consola.start('Sync package.json & README into dist');
  for (const pkg of packages) {
    await copyMeta(pkg, version);
  }

  consola.success('Build pipeline finished');
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
