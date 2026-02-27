/**
 * dashboard dist 的 d.ts 健康检查：校验关键声明文件存在且数量达到预期。
 */
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
    throw new Error(`未找到 dashboard dist 目录：${distRoot}`);
  }

  const dtsFiles = await fg(['**/*.d.ts'], { cwd: distRoot, dot: true, onlyFiles: true });
  if (dtsFiles.length < MIN_DTS_COUNT) {
    throw new Error(`dashboard d.ts 数量过少：${dtsFiles.length} < ${MIN_DTS_COUNT}`);
  }

  for (const rel of REQUIRED_DTS_FILES) {
    const abs = path.join(distRoot, rel);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`缺少 dashboard 必需的 d.ts：${rel}`);
    }
  }

  consola.success(`dashboard d.ts 校验通过（${dtsFiles.length} 个文件）`);
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
