import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@grafana-fast/component': resolve(__dirname, '../packages/component/src'),
      '@grafana-fast/hooks': resolve(__dirname, '../packages/hooks'),
      '@grafana-fast/types': resolve(__dirname, '../packages/types'),
      '#': resolve(__dirname, '../packages/component/src')
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        additionalData: `@import "${resolve(__dirname, '../packages/component/assets/styles/variables.less')}";`
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
})
