import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const hookEntry = path.join(root, 'packages/hook/src/index.ts');
const hookDist = path.join(root, 'packages/hook/dist');

export default [
  {
    input: hookEntry,
    output: [
      { file: path.join(hookDist, 'index.mjs'), format: 'es' },
      { file: path.join(hookDist, 'index.cjs'), format: 'cjs' }
    ],
    plugins: [esbuild({ target: 'esnext' })],
    external: ['vue', 'pinia', '@grafana-fast/component', '@grafana-fast/types']
  },
  {
    input: hookEntry,
    output: { file: path.join(hookDist, 'index.d.ts'), format: 'es' },
    plugins: [dts()],
    external: [/\\.css$/, /\\.less$/]
  }
];
