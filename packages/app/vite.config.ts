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
  plugins: [vue()],
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
            '@grafana-fast/api': resolveFromRoot('../api/src/index.ts'),
            '@grafana-fast/panels': resolveFromRoot('../panels/src/index.ts'),
            '@grafana-fast/types': resolveFromRoot('../types/src/index.ts'),
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
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
