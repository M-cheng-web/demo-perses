import path from 'path';
import consola from 'consola';
import { packages, run } from './utils.js';

async function main() {
  for (const pkg of packages) {
    const dist = path.join(pkg.dir, 'dist');
    consola.box(`Publishing ${pkg.name} from ${dist}`);
    run('npm publish --access public', dist);
  }
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
