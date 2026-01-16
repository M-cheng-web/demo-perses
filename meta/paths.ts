import path from 'path';
import { fileURLToPath } from 'url';

const metaFile = fileURLToPath(import.meta.url);
const metaDir = path.dirname(metaFile);

export const rootDir = path.resolve(metaDir, '..');
export const packagesDir = path.resolve(rootDir, 'packages');

export function resolveFromRoot(...parts: string[]) {
  return path.resolve(rootDir, ...parts);
}
