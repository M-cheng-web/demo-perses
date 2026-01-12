import consola from 'consola';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import { rootDir, readRootVersion } from './utils.js';
import { packages as metaPackages, publishPackages, resolvePackageDir } from '../meta/packages.js';

type DependencyField = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

function rewriteInternalDepsToWorkspace(pkgJSON: Record<string, unknown>) {
  const fields: DependencyField[] = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  let changed = false;

  for (const field of fields) {
    const record = pkgJSON[field];
    if (!record || typeof record !== 'object') continue;

    for (const [name, range] of Object.entries(record as Record<string, unknown>)) {
      if (!name.startsWith('@grafana-fast/')) continue;
      if (range === 'workspace:*') continue;
      (record as Record<string, unknown>)[name] = 'workspace:*';
      changed = true;
    }
  }

  return changed;
}

async function updateWorkspacePackage(pkgJSONPath: string, rootVersion: string) {
  const pkgJSON = (await fs.readJSON(pkgJSONPath)) as Record<string, unknown>;
  let changed = false;

  if (typeof pkgJSON.version === 'string' && pkgJSON.version !== rootVersion) {
    pkgJSON.version = rootVersion;
    changed = true;
  }

  if (rewriteInternalDepsToWorkspace(pkgJSON)) {
    changed = true;
  }

  if (!changed) return false;

  await fs.writeJSON(pkgJSONPath, pkgJSON, { spaces: 2 });
  return true;
}

async function main() {
  const rootVersion = await readRootVersion();

  const packageJSONPaths = publishPackages.map((pkg) => path.join(resolvePackageDir(pkg.name), 'package.json'));
  const existingPackageJSONPaths = await fg(packageJSONPaths, {
    absolute: true,
    onlyFiles: true,
  });

  const discoveredPackageJSONPaths = await fg('packages/*/package.json', {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
  });

  const metaPackageNames = new Set(metaPackages.map((pkg) => pkg.name));
  for (const pkgJSONPath of discoveredPackageJSONPaths) {
    const pkgDir = path.basename(path.dirname(pkgJSONPath));
    if (!metaPackageNames.has(pkgDir)) {
      consola.warn(`发现未登记到 meta 的 workspace 包：packages/${pkgDir}`);
    }
  }

  let updatedCount = 0;
  for (const pkgJSONPath of existingPackageJSONPaths) {
    const updated = await updateWorkspacePackage(pkgJSONPath, rootVersion);
    if (updated) {
      updatedCount += 1;
      consola.success(`已更新 ${path.relative(rootDir, pkgJSONPath)}`);
    }
  }

  if (updatedCount === 0) {
    consola.info('workspace 内 package.json 已是最新');
  } else {
    consola.box(`已更新 ${updatedCount} 个 workspace package.json 文件`);
  }
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
