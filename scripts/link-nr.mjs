#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binDir = path.join(rootDir, 'node_modules', '.bin');
const binPath = path.join(binDir, 'nr');

async function ensureBin() {
  await fs.promises.mkdir(binDir, { recursive: true });

  // 使用 POSIX shell shim（同 pnpm 自带的 bin wrapper 风格），避免依赖 Node 对
  // “无扩展名文件”的 ESM 识别行为差异。
  const shim = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")
exec node "$basedir/../../scripts/nr.mjs" "$@"
`;

  await fs.promises.writeFile(binPath, shim, 'utf8');
  await fs.promises.chmod(binPath, 0o755);
}

ensureBin().catch((error) => {
  console.error(error);
  process.exit(1);
});
