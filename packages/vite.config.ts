import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(async () => {
  return {
    server: {
      hmr: {
        overlay: false
      },
      fs: {
        allow: [resolve(__dirname, '..')]
      },
      host: '0.0.0.0',
      port: 8868
    },
    resolve: {
      alias: {
        '@grafana-fast/component': resolve(__dirname, 'component/src/index.ts'),
        '@grafana-fast/hooks': resolve(__dirname, 'hooks/index.ts'),
        '@grafana-fast/types': resolve(__dirname, 'types/index.ts'),
        '#': resolve(__dirname, 'component/src')
      }
    }
  }
})

