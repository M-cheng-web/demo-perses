import path from 'path';
import consola from 'consola';
import fs from 'fs-extra';
import { packages, rootDir, readRootVersion } from './utils.js';

async function removeDsStoreFiles(dir: string) {
  if (!(await fs.pathExists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await removeDsStoreFiles(abs);
        return;
      }
      if (entry.isFile() && entry.name === '.DS_Store') {
        await fs.remove(abs);
      }
    })
  );
}

function createOfflineReadme(version: string) {
  return `# grafana-fast 离线安装包

版本：${version}

该目录包含 grafana-fast 各子包的离线可安装产物（每个子目录都是一个可安装的本地 npm 包），用于“无需发布到 registry，也能让别的项目安装使用”。

## 安装（pnpm）

在你的项目根目录执行（把路径替换为你实际放置此目录的位置）：

\`\`\`bash
pnpm add /path/to/release/*/
\`\`\`

说明：该命令会把这些本地包安装进你的项目 \`node_modules\`，因此像
\`@grafana-fast/hooks\` 里 \`import { createPinia } from '@grafana-fast/store'\` 这种“包名导入”就能被正常解析。

然后安装 peerDependencies（宿主项目需要提供）：

\`\`\`bash
pnpm add vue echarts @ant-design/icons-vue
\`\`\`

## 说明

- 该离线包解决的是“\`@grafana-fast/*\` 包本身不依赖 registry”的问题（以文件夹形式离线安装）。
- 子包在 \`dependencies\` 里声明的第三方依赖（例如 \`jsonc-parser\`、\`@interactjs/core\` 等）仍需要 registry（或已有的 pnpm/npm 缓存）才能做到真正意义上的“全离线安装”。
`;
}

async function main() {
  const version = await readRootVersion();
  const outDir = path.join(rootDir, 'release');

  consola.start(`生成离线安装包（输出目录：${outDir}）`);
  await fs.remove(outDir);
  await fs.ensureDir(outDir);

  await fs.writeFile(path.join(outDir, 'README.md'), createOfflineReadme(version), 'utf8');

  for (const pkg of packages) {
    const distDir = path.join(pkg.dir, 'dist');
    const pkgDirName = path.basename(pkg.dir);
    consola.start(`打包 ${pkg.name}（目录：${distDir}）`);
    if (!(await fs.pathExists(distDir))) {
      throw new Error(`dist 目录不存在，请先执行 pnpm build：${distDir}`);
    }

    await removeDsStoreFiles(distDir);

    // Uncompressed folder form (installable via `pnpm add /path/to/offline/packages/<dir>`)
    await fs.copy(distDir, path.join(outDir, pkgDirName), {
      overwrite: true,
      filter: (src) => path.basename(src) !== '.DS_Store',
    });
    consola.success(`OK: ${pkg.name}`);
  }

  consola.success(`离线文件夹产物已生成：${outDir}`);
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
