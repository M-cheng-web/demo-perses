import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '#': resolve(__dirname, './src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GrafanaFastComponent',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: ['vue', 'pinia', 'ant-design-vue', 'echarts', 'dayjs', '@grafana-fast/types'],
      output: {
        globals: {
          vue: 'Vue',
          pinia: 'Pinia',
          'ant-design-vue': 'AntDesignVue',
          echarts: 'echarts',
          dayjs: 'dayjs'
        }
      }
    }
  }
})
