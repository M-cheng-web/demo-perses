import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const resolveFromRoot = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '/@/': `${resolveFromRoot('src')}/`,
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        additionalData: `@import \"/@/styles/theme.less\";`,
      },
    },
  },
  build: {
    lib: {
      entry: {
        index: resolveFromRoot('src/index.ts'),
        exports: resolveFromRoot('src/exports.ts'),
        styles: resolveFromRoot('src/styles.ts'),
      },
      name: 'GrafanaFastUI',
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'mjs' : format === 'cjs' ? 'cjs' : format;
        return `${entryName}.${ext}`;
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', '@ant-design/icons-vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});
