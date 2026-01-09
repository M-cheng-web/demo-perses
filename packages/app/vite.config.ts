import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const resolveFromRoot = (p: string) => path.resolve(__dirname, p);

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolveFromRoot('./src'),
      '/#/': `${resolveFromRoot('../component/src')}/`,
      '@grafana-fast/component': resolveFromRoot('../component/src/index.ts'),
      '@grafana-fast/store': resolveFromRoot('../store/src/index.ts'),
      '@grafana-fast/hooks': resolveFromRoot('../hook/src/index.ts'),
      '@grafana-fast/types': resolveFromRoot('../types/src/index.ts'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        additionalData: `@import \"/#/assets/styles/variables.less\"; @import \"/#/assets/styles/mixins.less\";`,
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
