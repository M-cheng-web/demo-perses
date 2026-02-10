/**
 * packages/app 的 Vite 配置（演示站点）
 *
 * 说明：
 * - 该包作为“回归验证平台”，开发时默认直接引用工作区源码（alias 到 ../xxx/src）
 * - 通过 `GF_USE_DIST=1` 可以切换为消费各包的 dist 产物（更接近发布后的集成形态）
 */
import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const resolveFromRoot = (p: string) => path.resolve(__dirname, p);
const useDist = process.env.GF_USE_DIST === '1';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // 说明：在 pnpm + workspace 下，vite/plugin-vue 可能出现“重复 vite 类型”导致的 TS 类型不兼容。
  // 这不影响实际运行与构建产物，因此这里做一个窄范围的类型收敛，避免阻断 `pnpm build`。
  plugins: [vue() as any],
  resolve: {
    alias: {
      '@': resolveFromRoot('./src'),
      ...(useDist
        ? {}
        : {
            '/#/': `${resolveFromRoot('../dashboard/src')}/`,
            '@grafana-fast/dashboard': resolveFromRoot('../dashboard/src/index.ts'),
            '@grafana-fast/component': resolveFromRoot('../component/src/index.ts'),
            '@grafana-fast/store': resolveFromRoot('../store/src/index.ts'),
            '@grafana-fast/hooks': resolveFromRoot('../hook/src/index.ts'),
            '@grafana-fast/api/mock': resolveFromRoot('../api/src/mock.ts'),
            '@grafana-fast/api': resolveFromRoot('../api/src/index.ts'),
            '@grafana-fast/json-editor': resolveFromRoot('../json-editor/src/index.ts'),
            '@grafana-fast/types': resolveFromRoot('../types/src/index.ts'),
            '@grafana-fast/utils': resolveFromRoot('../utils/src/index.ts'),
            '@grafana-fast/promql': resolveFromRoot('../promql/src/index.ts'),
          }),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        additionalData: useDist ? '' : `@import \"/#/assets/styles/variables.less\"; @import \"/#/assets/styles/mixins.less\";`,
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
