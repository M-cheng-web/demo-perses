/**
 * release/ 同步脚本：把仓库根目录的 release/ 拷贝到 app-release 的 vendor 目录，用于本地验证离线消费。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(projectDir, '../..');
const releaseDir = path.join(repoRoot, 'release');

function fail(message) {
  console.error(`[app-release] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(releaseDir)) {
  fail(`未找到 release 目录：${releaseDir}。请先在仓库根目录执行 pnpm build。`);
}

const requiredFiles = ['index.mjs', 'style.css', 'index.d.ts', 'index.d.mts', 'mock.mjs'];
for (const f of requiredFiles) {
  const abs = path.join(releaseDir, f);
  if (!fs.existsSync(abs)) {
    fail(`release 缺少必要文件：${abs}。请先在仓库根目录执行 pnpm build。`);
  }
}

const vendorDir = path.join(projectDir, 'vendor', 'grafana-fast');
fs.rmSync(vendorDir, { recursive: true, force: true });
fs.mkdirSync(vendorDir, { recursive: true });

fs.cpSync(releaseDir, vendorDir, {
  recursive: true,
  dereference: true,
  filter: (src) => path.basename(src) !== '.DS_Store',
});

console.log(`[app-release] 已同步 release bundle 到：${path.relative(projectDir, vendorDir)}`);
