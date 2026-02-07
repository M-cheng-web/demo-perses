import path from 'path';
import consola from 'consola';
import fg from 'fast-glob';
import fs from 'fs-extra';
import { rootDir } from './utils.js';

const MIN_DTS_COUNT = 80;

const REQUIRED_DTS_FILES = [
  'index.d.ts',
  'components/Dashboard/DashboardView.vue.d.ts',
  'runtime/piniaAttachments.d.ts',
  'query/queryScheduler.d.ts',
  'utils/strictJsonValidators.d.ts',
] as const;

async function main() {
  const distRoot = path.join(rootDir, 'packages/dashboard/dist');
  if (!(await fs.pathExists(distRoot))) {
    throw new Error(`dashboard dist not found: ${distRoot}`);
  }

  const dtsFiles = await fg(['**/*.d.ts'], { cwd: distRoot, dot: true, onlyFiles: true });
  if (dtsFiles.length < MIN_DTS_COUNT) {
    throw new Error(`dashboard d.ts count too low: ${dtsFiles.length} < ${MIN_DTS_COUNT}`);
  }

  for (const rel of REQUIRED_DTS_FILES) {
    const abs = path.join(distRoot, rel);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`dashboard required d.ts missing: ${rel}`);
    }
  }

  consola.success(`dashboard d.ts assertion passed (${dtsFiles.length} files)`);
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
