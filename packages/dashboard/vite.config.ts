/**
 * @grafana-fast/dashboard 的 Vite 构建配置
 *
 * 说明：
 * - dashboard 作为 library 产物对外发布，走 `build.lib` 产出 ESM/CJS
 * - 运行时依赖（vue/echarts 等）通过 rollup external 排除，交给宿主应用提供
 * - `/#/` alias 用于包内部的绝对导入路径（仅在本包源码内使用）
 */
import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const resolveFromRoot = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '/#/': `${resolveFromRoot('src')}/`,
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        additionalData: `@import "/#/assets/styles/variables.less"; @import "/#/assets/styles/mixins.less";`,
        javascriptEnabled: true,
      },
    },
  },
  build: {
    lib: {
      entry: resolveFromRoot('src/index.ts'),
      name: 'GrafanaFastDashboard',
      fileName: (format) => {
        if (format === 'es') return 'index.mjs';
        if (format === 'cjs') return 'index.cjs';
        return `index.${format}.js`;
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'vue',
        '@grafana-fast/store',
        '@grafana-fast/component',
        '@grafana-fast/api',
        '@ant-design/icons-vue',
        '@grafana-fast/types',
        'echarts',
        'vue-grid-layout-v3',
      ],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});
