/**
 * 仓库路径常量：从 meta 目录定位 root/packages，并提供 resolveFromRoot 工具函数。
 */
import path from 'path';
import { fileURLToPath } from 'url';

const metaFile = fileURLToPath(import.meta.url);
const metaDir = path.dirname(metaFile);

export const rootDir = path.resolve(metaDir, '..');
export const packagesDir = path.resolve(rootDir, 'packages');

export function resolveFromRoot(...parts: string[]) {
  return path.resolve(rootDir, ...parts);
}
