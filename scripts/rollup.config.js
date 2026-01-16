/**
 * 文件说明：Rollup 构建配置
 *
 * 用途：
 * - 负责 workspace 多 package 的产物打包输出（dist/types 等）
 * - 在 CI/脚本中由 `scripts/build.ts` 等入口驱动执行
 */
import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

const pkgRoot = process.cwd();
const entry = path.join(pkgRoot, 'src/index.ts');
const dist = path.join(pkgRoot, 'dist');
const pkgName = path.basename(pkgRoot);

const externalsByPkg = {
  api: ['@grafana-fast/types'],
  hook: ['vue', '@grafana-fast/store', '@grafana-fast/dashboard', '@grafana-fast/types', '@grafana-fast/api'],
  panels: ['vue', '@grafana-fast/dashboard'],
  store: ['vue'],
};

const external = externalsByPkg[pkgName] ?? ['vue'];

export default [
  {
    input: entry,
    output: [
      { file: path.join(dist, 'index.mjs'), format: 'es' },
      { file: path.join(dist, 'index.cjs'), format: 'cjs' },
    ],
    plugins: [esbuild({ target: 'esnext' })],
    external,
  },
  {
    input: entry,
    output: { file: path.join(dist, 'index.d.ts'), format: 'es' },
    plugins: [dts()],
    external: [/\.css$/, /\.less$/],
  },
];
