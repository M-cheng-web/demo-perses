import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import { parse, compileScript } from '@vue/compiler-sfc';
import { transformSync } from 'esbuild';

const pkgRoot = process.cwd();
const entry = path.join(pkgRoot, 'src/index.ts');
const dist = path.join(pkgRoot, 'dist');
const pkgName = path.basename(pkgRoot);

const inputByPkg = {
  api: {
    index: path.join(pkgRoot, 'src/index.ts'),
    mock: path.join(pkgRoot, 'src/mock.ts'),
  },
};

const input = inputByPkg[pkgName] ?? entry;
const isMultiEntry = typeof input === 'object';

const externalsByPkg = {
  utils: ['@grafana-fast/types'],
  api: ['@grafana-fast/types', '@grafana-fast/utils'],
  promql: ['@grafana-fast/types', '@grafana-fast/utils', '@prometheus-io/lezer-promql', '@lezer/common', '@lezer/lr', '@lezer/highlight'],
  'json-editor': ['vue', '@grafana-fast/component', '@grafana-fast/types', '@grafana-fast/utils', 'jsonc-parser'],
  hook: ['vue', '@grafana-fast/store', '@grafana-fast/dashboard', '@grafana-fast/types', '@grafana-fast/api', '@grafana-fast/utils'],
  panels: ['vue', '@grafana-fast/dashboard'],
  store: ['vue'],
};

const external = externalsByPkg[pkgName] ?? ['vue'];

/**
 * 说明：最小化的 Vue SFC 编译插件（仅供本仓库的 rollup 构建使用）
 *
 * 背景：
 * - 我们希望 json-editor 这种 UI 子包也能用 `.vue` + `<template>` 的统一风格实现
 * - 但当前仓库的 Node 版本环境可能不满足 Vite 7 / @vitejs/plugin-vue 的引擎要求
 * - 因此这里基于 `@vue/compiler-sfc` 做一个“够用”的 rollup 插件：只编译 template + script（不处理 style）
 *
 * 约束：
 * - 目前只用于 json-editor 子包（其它 package 仍然是纯 TS）
 * - 不支持 scoped style、css modules（json-editor 目前也不需要）
 */
function vueSfcMinimal() {
  return {
    name: 'vue-sfc-minimal',
    transform(code, id) {
      if (!id.endsWith('.vue')) return null;

      // 为了让编译结果在不同文件间稳定，使用一个简单的 hash 作为 SFC scope id
      const hash = Buffer.from(id)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 8);
      const { descriptor } = parse(code, { filename: id });

      // json-editor 组件全部使用 <script setup>；如果未来出现普通 <script>，也能兼容
      const compiled = compileScript(descriptor, {
        id: hash,
        inlineTemplate: true, // 关键：把 template 编译进 script，避免 runtime compiler 依赖
      });

      // 注意：compileScript 输出仍可能包含 TS，因此这里直接用 esbuild 转成 ESM JS
      const js = transformSync(compiled.content, {
        loader: 'ts',
        format: 'esm',
        target: 'esnext',
        sourcefile: id,
        sourcemap: true,
      });

      return { code: js.code, map: js.map };
    },
  };
}

export default [
  {
    input,
    output: isMultiEntry
      ? [
          { dir: dist, format: 'es', entryFileNames: '[name].mjs' },
          { dir: dist, format: 'cjs', entryFileNames: '[name].cjs' },
        ]
      : [
          { file: path.join(dist, 'index.mjs'), format: 'es' },
          { file: path.join(dist, 'index.cjs'), format: 'cjs' },
        ],
    plugins: [
      // 仅在 json-editor 中启用 .vue 编译，避免影响其他纯 TS 包的构建速度/复杂度
      ...(pkgName === 'json-editor' ? [vueSfcMinimal()] : []),
      esbuild({ target: 'esnext' }),
    ],
    external,
  },
  // json-editor 的类型产物由 `vue-tsc --emitDeclarationOnly` 生成（因为包含 .vue SFC）
  ...(pkgName === 'json-editor'
    ? []
    : [
        {
          input,
          output: isMultiEntry ? { dir: dist, format: 'es', entryFileNames: '[name].d.ts' } : { file: path.join(dist, 'index.d.ts'), format: 'es' },
          plugins: [dts()],
          external: [...external, /\.css$/, /\.less$/],
        },
      ]),
];
