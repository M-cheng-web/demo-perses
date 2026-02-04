import { execSync } from 'child_process';
import fs from 'fs-extra';
import consola from 'consola';
import path from 'path';
import { rootDir } from '../meta/paths.js';
import { publishPackages, resolvePackageDir } from '../meta/packages.js';

export { rootDir };

export interface PkgInfo {
  name: string;
  dir: string;
}

export async function readRootPackageJSON(): Promise<Record<string, unknown>> {
  const pkgJSONPath = path.join(rootDir, 'package.json');
  return fs.readJSON(pkgJSONPath);
}

export async function readRootVersion(): Promise<string> {
  const pkgJSON = await readRootPackageJSON();
  const version = pkgJSON?.version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`Invalid root version in ${path.join(rootDir, 'package.json')}`);
  }
  return version;
}

export const packages: PkgInfo[] = [
  ...publishPackages.map((pkg) => {
    if (!pkg.packageName) {
      throw new Error(`Missing packageName for meta package: ${pkg.name}`);
    }
    return { name: pkg.packageName, dir: resolvePackageDir(pkg.name) };
  }),
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

function stripDistPrefix(p: string): string {
  // When we publish from `<pkg>/dist`, that folder becomes the package root.
  // So `dist/index.mjs` -> `index.mjs`, `./dist/index.d.ts` -> `./index.d.ts`.
  return p.replace(/^(\.\/)?dist\//, '$1');
}

function rewriteDistPathsForPublish(pkgJSON: Record<string, any>) {
  for (const field of ['main', 'module', 'types']) {
    const v = pkgJSON[field];
    if (typeof v === 'string') pkgJSON[field] = stripDistPrefix(v);
  }

  const rewriteExports = (value: unknown): unknown => {
    if (typeof value === 'string') return stripDistPrefix(value);
    if (Array.isArray(value)) return value.map((v) => rewriteExports(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = rewriteExports(v);
      }
      return out;
    }
    return value;
  };

  if (pkgJSON.exports) {
    pkgJSON.exports = rewriteExports(pkgJSON.exports);
  }

  // `files: ["dist"]` is correct when publishing from the package root.
  // But we publish from `<pkg>/dist`, so keeping it would publish nothing.
  delete pkgJSON.files;

  // Dist-only publish should not ship internal build scripts.
  delete pkgJSON.scripts;
  delete pkgJSON.devDependencies;
}

export async function copyMeta(pkg: PkgInfo, version: string) {
  const distDir = path.join(pkg.dir, 'dist');
  await fs.ensureDir(distDir);

  const pkgJSON = await rewriteWorkspaceVersion(pkg.dir, version);
  rewriteDistPathsForPublish(pkgJSON);
  await fs.writeJSON(path.join(distDir, 'package.json'), pkgJSON, { spaces: 2 });

  const readmePath = path.join(pkg.dir, 'README.md');
  if (await fs.pathExists(readmePath)) {
    await fs.copy(readmePath, path.join(distDir, 'README.md'));
  }
}
