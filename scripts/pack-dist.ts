/**
 * release/ 离线产物打包脚本：
 * - 生成可直接拷贝使用的单文件 SDK（release/index.mjs）
 * - 生成不依赖 `@grafana-fast/*` 的 standalone 类型声明（release/index.d.ts）
 * - 合并内部包与构建产物提取的 CSS（release/style.css）
 */
import path from 'path';
import consola from 'consola';
import fs from 'fs-extra';
import * as esbuild from 'esbuild';
import { packages, rootDir, readRootVersion } from './utils.js';

type ReleaseEntry = {
  /** 模块 specifier（用于 import 解析） */
  spec: string;
  /** 对应入口文件的绝对路径 */
  absPath: string;
};

async function resolveDistEntry(pkgDir: string): Promise<string> {
  const distDir = path.join(pkgDir, 'dist');
  const entryMjs = path.join(distDir, 'index.mjs');
  const entryJs = path.join(distDir, 'index.js');

  if (await fs.pathExists(entryMjs)) return entryMjs;
  if (await fs.pathExists(entryJs)) return entryJs;

  throw new Error(`dist entry not found: ${pkgDir} (expected dist/index.mjs or dist/index.js)`);
}

async function createReleaseReadme(version: string) {
  return `# grafana-fast release bundle

版本：${version}

该目录用于“**不通过 npm 安装 @grafana-fast/* 包**”的分发形态：可将整个 \`release/\` 文件夹复制到任意宿主项目中，
宿主项目提供必要的 peer dependencies 后，直接 import \`release/index.mjs\` 即可使用 \`useDashboardSdk\`。

## 需要复制哪些文件？

复制整个 \`release/\` 文件夹即可（建议放到宿主项目的 \`src/vendor/grafana-fast/\` 或类似目录）。

## 宿主项目需要安装的依赖（peer deps）

> 注意：Vue 必须由宿主提供（不能内置），否则会出现“Ref / watch 不互通”的问题。

\`\`\`bash
pnpm add vue echarts @ant-design/icons-vue
\`\`\`

## 使用方式

\`\`\`ts
import { ref } from 'vue';
import { useDashboardSdk } from './vendor/grafana-fast/index.mjs';

const containerRef = ref<HTMLElement | null>(null);

	const sdk = useDashboardSdk(containerRef, {
	  // 远程模式：宿主自行提供 apiClient + getDashboardSessionKey
	  // apiClient: yourApiClient（示例）,
	  // getDashboardSessionKey: async () => '...'（示例）,
	});
\`\`\`

### 样式（必须）

\`release/index.mjs\` 已默认 \`import './style.css'\`（适用于 Vite/Webpack 等构建工具）。
若构建链不支持从 JS import CSS，请在入口手动引入：

\`\`\`ts
import './vendor/grafana-fast/style.css';
\`\`\`

## 可选：使用内置 mock（本地演示）

该目录额外提供 \`mock.mjs\`（等价于 \`@grafana-fast/api/mock\`），仅用于本地演示/回归：

\`\`\`ts
const { createMockApiClient } = await import('./vendor/grafana-fast/mock.mjs');
const api = createMockApiClient();
\`\`\`
`;
}

function transformHookTypesToStandalone(raw: string) {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.includes("from '@grafana-fast/api'")) continue;
    if (line.includes("from '@grafana-fast/dashboard'")) continue;
    if (line.includes("from '@grafana-fast/types'")) continue;
    out.push(line);
  }

  const injected: string[] = [];
  injected.push('// 注意：该文件由 scripts/pack-dist.ts 生成（release bundle 类型）。');
  injected.push('// 该文件会刻意避免任何 `@grafana-fast/*` 的类型导入，以便在不安装 workspace 包的情况下直接使用。');
  injected.push('type ID = string;');
  injected.push('type Timestamp = number;');
  injected.push('interface TimeRange { from: string | Timestamp; to: string | Timestamp; }');
  injected.push("type DashboardTheme = 'light' | 'dark';");
  injected.push("type DashboardThemePreference = DashboardTheme | 'system';");
  injected.push('type GrafanaFastApiClient = any;');

  const merged = out
    .join('\n')
    .replace(/type DashboardApi = HttpApiEndpointKey;/g, 'type DashboardApi = (typeof DashboardApi)[keyof typeof DashboardApi];');

  const marker = "import { Ref } from 'vue';";
  if (!merged.includes(marker)) {
    throw new Error('hook 的 dist d.ts 结构不符合预期：缺少 vue Ref 的 import。');
  }

  const withInjection = merged.replace(marker, `${marker}\n\n${injected.join('\n')}`);

  if (/from '@grafana-fast\//.test(withInjection)) {
    throw new Error('release 类型声明不应包含任何 @grafana-fast/* import 语句。');
  }

  return withInjection.trimEnd() + '\n';
}

async function buildReleaseBundle(entries: ReleaseEntry[], outFile: string, external: string[], options: { bannerCssImport?: boolean } = {}) {
  const table = new Map(entries.map((e) => [e.spec, e.absPath]));

  const aliasPlugin: esbuild.Plugin = {
    name: 'grafana-fast-dist-alias',
    setup(build) {
      build.onResolve({ filter: /^@grafana-fast\// }, (args) => {
        const direct = table.get(args.path);
        if (direct) return { path: direct };
        return null;
      });
    },
  };

  await esbuild.build({
    entryPoints: [entries[0].absPath],
    outfile: outFile,
    format: 'esm',
    platform: 'browser',
    bundle: true,
    splitting: false,
    treeShaking: true,
    target: 'es2020',
    external,
    minify: true,
    legalComments: 'none',
    ...(options.bannerCssImport
      ? {
          banner: {
            js: `import './style.css';\n`,
          },
        }
      : {}),
    plugins: [aliasPlugin],
  });
}

async function main() {
  const version = await readRootVersion();
  const outDir = path.join(rootDir, 'release');

  consola.start(`生成 release bundle（输出目录：${outDir}）`);
  await fs.remove(outDir);
  await fs.ensureDir(outDir);

  await fs.writeFile(path.join(outDir, 'README.md'), await createReleaseReadme(version), 'utf8');

  const hookPkg = packages.find((p) => p.name === '@grafana-fast/hooks');
  if (!hookPkg) throw new Error('Cannot find @grafana-fast/hooks in meta package list.');

  // 1) index.mjs：把 hooks + 内部依赖打包为单文件（peer deps 由宿主提供）
  const internalEntries: ReleaseEntry[] = [];
  for (const pkg of packages) {
    const abs = await resolveDistEntry(pkg.dir);
    internalEntries.push({ spec: pkg.name, absPath: abs });

    // 可选：为演示提供子路径导出（仅用于便捷引用）
    if (pkg.name === '@grafana-fast/api') {
      const mock = path.join(pkg.dir, 'dist', 'mock.mjs');
      if (await fs.pathExists(mock)) internalEntries.push({ spec: '@grafana-fast/api/mock', absPath: mock });
    }
    if (pkg.name === '@grafana-fast/component') {
      const styles = path.join(pkg.dir, 'dist', 'styles.mjs');
      if (await fs.pathExists(styles)) internalEntries.push({ spec: '@grafana-fast/component/styles', absPath: styles });
    }
  }

  const hookEntry = internalEntries.find((e) => e.spec === '@grafana-fast/hooks');
  if (!hookEntry) throw new Error('Cannot resolve dist entry for @grafana-fast/hooks.');

  consola.start(`bundle SDK: ${hookEntry.spec} -> release/index.mjs`);
  await buildReleaseBundle(
    [hookEntry, ...internalEntries],
    path.join(outDir, 'index.mjs'),
    [
      // peer deps：由宿主提供（需使用同一 Vue 实例）
      'vue',
      'echarts',
      '@ant-design/icons-vue',
    ],
    { bannerCssImport: true }
  );
  consola.success('OK: release/index.mjs');

  // 2) 可选：mock 入口（本地演示用，等价于 @grafana-fast/api/mock）
  const apiMock = internalEntries.find((e) => e.spec === '@grafana-fast/api/mock');
  if (apiMock) {
    consola.start(`bundle mock: ${apiMock.spec} -> release/mock.mjs`);
    await buildReleaseBundle([apiMock, ...internalEntries], path.join(outDir, 'mock.mjs'), []);
    consola.success('OK: release/mock.mjs');
  } else {
    consola.warn('跳过 release/mock.mjs（未找到 dist/mock.mjs）。');
  }

  // 3) index.d.ts：standalone 类型声明（不包含 @grafana-fast/* 导入）
  const hookTypesPath = path.join(hookPkg.dir, 'dist', 'index.d.ts');
  if (!(await fs.pathExists(hookTypesPath))) {
    throw new Error(`hook types not found: ${hookTypesPath}`);
  }
  const hookTypesRaw = await fs.readFile(hookTypesPath, 'utf8');
  const types = transformHookTypesToStandalone(hookTypesRaw);
  await fs.writeFile(path.join(outDir, 'index.d.ts'), types, 'utf8');
  // 对 NodeNext/Node16 解析更友好：补充 `.d.mts`，匹配 `index.mjs` 的导入习惯。
  await fs.writeFile(path.join(outDir, 'index.d.mts'), types, 'utf8');

  // 4) 可选：mock.d.ts（最小声明）
  if (apiMock) {
    const mockTypes = `// 注意：该文件由 scripts/pack-dist.ts 生成（release mock 类型）。\nexport declare function createMockApiClient(): any;\n`;
    await fs.writeFile(path.join(outDir, 'mock.d.ts'), mockTypes, 'utf8');
    await fs.writeFile(path.join(outDir, 'mock.d.mts'), mockTypes, 'utf8');
  }

  // 5) style.css：合并内部包样式 + esbuild 提取的 CSS
  const cssFiles = [path.join(rootDir, 'packages/component/dist/component.css'), path.join(rootDir, 'packages/dashboard/dist/dashboard.css')];
  let css = `/* grafana-fast release 样式（v${version}） */\n`;
  for (const file of cssFiles) {
    if (await fs.pathExists(file)) {
      css += `\n/* 来源：${path.relative(rootDir, file)} */\n`;
      css += await fs.readFile(file, 'utf8');
      css += '\n';
    } else {
      consola.warn(`CSS file not found (skipped): ${file}`);
    }
  }

  // esbuild 会把 CSS import 提取为独立的 `.css` 文件（例如 vue-grid-layout 的样式）。
  // 这里将其合并到单一的 `style.css`，便于直接拷贝与引用。
  const releaseEntries = await fs.readdir(outDir, { withFileTypes: true });
  const extractedCssFiles = releaseEntries
    .filter((e) => e.isFile() && e.name.endsWith('.css') && e.name !== 'style.css')
    .map((e) => path.join(outDir, e.name))
    .sort();

  for (const file of extractedCssFiles) {
    css += `\n/* 来源：${path.relative(outDir, file)}（esbuild 提取） */\n`;
    css += await fs.readFile(file, 'utf8');
    css += '\n';
  }

  await fs.writeFile(path.join(outDir, 'style.css'), css, 'utf8');

  // 清理被提取的 css 临时文件：最终仅保留 `style.css`。
  for (const file of extractedCssFiles) {
    await fs.remove(file);
  }

  consola.success(`release bundle 产物已生成：${outDir}`);
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
