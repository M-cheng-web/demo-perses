/**
 * scripts 工具函数：读取版本、执行命令、改写 workspace 依赖版本、同步 dist 元信息。
 */
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
  // 当从 `<pkg>/dist` 发布时，dist 目录会成为“发布包的根目录”。
  // 因此 `dist/index.mjs` -> `index.mjs`，`./dist/index.d.ts` -> `./index.d.ts`。
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

  // `files: ["dist"]` 只在“从包根目录发布”时才正确。
  // 当前仓库从 `<pkg>/dist` 发布，因此保留该字段会导致发布内容为空。
  delete pkgJSON.files;

  // 从 dist 发布时不应携带内部构建脚本与 devDependencies。
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
