import path from 'path';
import alias from '@rollup/plugin-alias';
import vue from '@vitejs/plugin-vue';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

const pkgRoot = process.cwd();
const entry = path.join(pkgRoot, 'src/index.ts');
const dist = path.join(pkgRoot, 'dist');
const pkgName = path.basename(pkgRoot);

const externalsByPkg = {
  hook: ['vue', '@grafana-fast/store', '@grafana-fast/component', '@grafana-fast/types'],
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
    plugins: [
      ...(pkgName === 'hook'
        ? [
            alias({
              entries: [{ find: '/#/', replacement: `${path.resolve(pkgRoot, '../component/src')}/` }],
            }),
            vue(),
          ]
        : []),
      esbuild({ target: 'esnext' }),
    ],
    external,
  },
  {
    input: entry,
    output: { file: path.join(dist, 'index.d.ts'), format: 'es' },
    plugins: [dts()],
    external: [/\.css$/, /\.less$/],
  },
];
