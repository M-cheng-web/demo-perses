import path from 'path';
import consola from 'consola';
import fs from 'fs-extra';
import { packages, run } from './utils.js';

function collectExportTargets(exportsField: unknown): string[] {
  if (!exportsField) return [];
  if (typeof exportsField === 'string') return [exportsField];
  if (Array.isArray(exportsField)) return exportsField.flatMap((v) => collectExportTargets(v));
  if (typeof exportsField === 'object') {
    return Object.values(exportsField as Record<string, unknown>).flatMap((v) => collectExportTargets(v));
  }
  return [];
}

function assertNoWorkspaceProtocol(record: unknown, label: string) {
  if (!record || typeof record !== 'object') return;
  for (const [name, range] of Object.entries(record as Record<string, unknown>)) {
    if (typeof range === 'string' && range.includes('workspace:')) {
      throw new Error(`${label} contains workspace protocol: ${name}@${range}`);
    }
  }
}

async function validateDist(distDir: string) {
  const pkgJSONPath = path.join(distDir, 'package.json');
  if (!(await fs.pathExists(pkgJSONPath))) {
    throw new Error(`缺少 dist/package.json：${pkgJSONPath}`);
  }

  const pkgJSON = await fs.readJSON(pkgJSONPath);

  for (const field of ['main', 'module', 'types']) {
    const rel = pkgJSON?.[field];
    if (typeof rel !== 'string') continue;
    const abs = path.join(distDir, rel);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`package.json#${field} 指向的文件不存在：${rel}`);
    }
  }

  const exportTargets = collectExportTargets(pkgJSON?.exports);
  for (const rel of exportTargets) {
    if (typeof rel !== 'string') continue;
    // External targets (e.g. "node:*") are allowed, we only verify local paths.
    if (!rel.startsWith('./') && !rel.startsWith('../')) continue;
    const abs = path.join(distDir, rel);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`package.json#exports 指向的文件不存在：${rel}`);
    }
  }

  assertNoWorkspaceProtocol(pkgJSON?.dependencies, 'dependencies');
  assertNoWorkspaceProtocol(pkgJSON?.peerDependencies, 'peerDependencies');

  const readmePath = path.join(distDir, 'README.md');
  if (!(await fs.pathExists(readmePath))) {
    consola.warn(`dist 内未找到 README.md：${distDir}`);
  }
}

async function main() {
  for (const pkg of packages) {
    const dist = path.join(pkg.dir, 'dist');
    consola.box(`发布 ${pkg.name}（目录：${dist}）`);
    await validateDist(dist);
    run('npm publish --access public', dist);
  }
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
