import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const resolveFromRoot = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  base: './',
  // 说明：在 pnpm + workspace 下，vite/plugin-vue 可能出现“重复 vite 类型”导致的 TS 类型不兼容。
  // 这不影响实际运行与构建产物，因此这里做一个窄范围的类型收敛，避免阻断启动。
  plugins: [vue() as any],
  resolve: {
    alias: {
      '@': resolveFromRoot('./src'),
    },
  },
  server: {
    port: 3010,
    host: true,
  },
});

