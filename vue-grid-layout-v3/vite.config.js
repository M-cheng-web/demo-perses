import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import eslint from '@rollup/plugin-eslint';
import pkg from './package.json';

function banner() {
  return {
    name: 'banner',
    enforce: 'post',
    generateBundle(options, bundle) {
      const banner = `/**\n * ${pkg.name} ${pkg.version}\n`
        + ` * ${pkg.author}\n * ${pkg.homepage}\n */\n`;

      for (const module of Object.values(bundle)) {
        if (module.type === 'chunk') {
          module.code = banner + module.code;
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [
    vue(),
    vueJsx(),
    eslint({
      include: ['./src/**/*.js', './src/**/*.vue'],
    }),
    libInjectCss(),
    banner(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/components/index.js'),
      name: 'VueGridLayout',
      // the proper extensions will be added
      fileName: 'vue-grid-layout-v3',
      formats: ['iife', 'es', 'umd', 'cjs'],
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue'],
      output: [{
        format: 'es',
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        // globals: { vue: 'Vue' },
      }, {
        name: 'VueGridLayout',
        format: 'iife',
        exports: 'named',
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: { vue: 'Vue' },
      }, {
        name: 'VueGridLayout',
        entryFileNames: 'vue-grid-layout-v3.umd.js',
        format: 'umd',
        exports: 'named',
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: { vue: 'Vue' },
      }, {
        format: 'cjs',
        exports: 'named',
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: { vue: 'Vue' },
      }],
    },
  },
}));
