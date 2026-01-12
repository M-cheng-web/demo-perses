import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import consola from 'consola';

export const rootDir = path.resolve(__dirname, '..');
export const packagesDir = path.resolve(rootDir, 'packages');

export interface PkgInfo {
  name: string;
  dir: string;
}

export const packages: PkgInfo[] = [
  { name: '@grafana-fast/types', dir: path.join(packagesDir, 'types') },
  { name: '@grafana-fast/component', dir: path.join(packagesDir, 'component') },
  { name: '@grafana-fast/dashboard', dir: path.join(packagesDir, 'dashboard') },
  { name: '@grafana-fast/hooks', dir: path.join(packagesDir, 'hook') },
];

export function run(command: string, cwd = rootDir) {
  consola.info(`$ ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

export async function rewriteWorkspaceVersion(pkgDir: string, version: string) {
  const pkgJSONPath = path.join(pkgDir, 'package.json');
  const pkgJSON = await fs.readJSON(pkgJSONPath);
  pkgJSON.version = version;

  for (const field of ['dependencies', 'peerDependencies']) {
    const record = pkgJSON[field];
    if (!record) continue;
    Object.keys(record).forEach((key) => {
      if (record[key] === 'workspace:*') {
        record[key] = version;
      }
    });
  }

  return pkgJSON;
}

export async function copyMeta(pkg: PkgInfo, version: string) {
  const distDir = path.join(pkg.dir, 'dist');
  await fs.ensureDir(distDir);

  const pkgJSON = await rewriteWorkspaceVersion(pkg.dir, version);
  await fs.writeJSON(path.join(distDir, 'package.json'), pkgJSON, { spaces: 2 });

  const readmePath = path.join(pkg.dir, 'README.md');
  if (await fs.pathExists(readmePath)) {
    await fs.copy(readmePath, path.join(distDir, 'README.md'));
  }
}
