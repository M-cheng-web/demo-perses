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
      name: 'GrafanaFastComponent',
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
        'pinia',
        'ant-design-vue',
        '@ant-design/icons-vue',
        'echarts',
        'dayjs',
        '@grafana-fast/types',
        'axios',
        'lodash-es',
        'uuid',
        'monaco-editor',
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
