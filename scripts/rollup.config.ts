import fs from 'fs'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'
import autoprefixer from 'autoprefixer'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import type { Options as ESBuildOptions } from 'rollup-plugin-esbuild'
import type { OutputOptions, Plugin, RollupOptions } from 'rollup'
import { functions } from '../packages/metadata/metadata'
import { packages } from '../meta/packages'

const configs: RollupOptions[] = []

const esbuildPlugin = esbuild({ target: 'esnext' })
const dtsPlugin = [dts()]

const externals = [
  'vue',
  '@grafana-fast/hooks',
  '@grafana-fast/types',
  '@grafana-fast/component',
  'ant-design-vue',
  'pinia',
  'echarts',
  'dayjs'
]

const esbuildMinifer = (options: ESBuildOptions) => {
  const { renderChunk } = esbuild(options)
  return { name: 'esbuild-minifer', renderChunk }
}

for (const {
  globals,
  name,
  external,
  iife,
  build,
  cjs,
  mjs,
  dts,
  target,
  singleChunk
} of packages) {
  if (build === false) continue

  const iifeGlobals = {
    'vue': 'Vue',
    '@grafana-fast/hooks': 'GrafanaFastHooks',
    '@grafana-fast/types': 'GrafanaFastTypes',
    '@grafana-fast/component': 'GrafanaFastComponent',
    ...(globals || {})
  }
  const iifeName = 'GrafanaFast'

  if (singleChunk) {
    // 打包组件专属
    const componentFun = functions.filter(item => item.package === 'component')
    configs.push({
      input: componentFun.reduce((pre, item) => {
        pre[item.name] = `packages/${name}/${item.name}/index.ts`
        return pre
      }, {}),
      output: [
        {
          dir: `packages/${name}/dist`,
          format: 'es',
          entryFileNames: '[name]/index.js'
        }
      ],
      plugins: [
        commonjs(),
        nodeResolve(),
        postcss({
          extensions: ['.css', '.less', '.scss'],
          extract: 'index.css',
          plugins: [
            autoprefixer({
              overrideBrowserslist: ['>=0%']
            })
          ]
        }),
        json(),
        vue() as any,
        vueJsx(),
        esbuildPlugin
      ] as any,
      external: [...externals, ...(external || [])]
    })
    configs.push({
      input: `packages/${name}/index.ts`,
      output: {
        dir: `packages/${name}/dist`,
        format: 'es',
        entryFileNames: 'index.d.ts'
      },
      plugins: dtsPlugin,
      external: [...externals, ...(external || []), /\.(css|less|scss)$/]
    })
  } else {
    // 打包 hooks & types
    const fn = 'index'
    const input = `packages/${name}/index.ts`
    const output: OutputOptions[] = []

    if (mjs !== false) {
      output.push({
        file: `packages/${name}/dist/${fn}.mjs`,
        format: 'es'
      })
    }

    if (cjs !== false) {
      output.push({
        file: `packages/${name}/dist/${fn}.cjs`,
        format: 'cjs'
      })
    }

    if (iife !== false) {
      output.push(
        {
          file: `packages/${name}/dist/${fn}.iife.js`,
          format: 'iife',
          name: iifeName,
          extend: true,
          globals: iifeGlobals
        },
        {
          file: `packages/${name}/dist/${fn}.iife.min.js`,
          format: 'iife',
          name: iifeName,
          extend: true,
          globals: iifeGlobals,
          plugins: [esbuildMinifer({ minify: true })]
        }
      )
    }

    configs.push({
      input,
      output,
      plugins: [
        commonjs(),
        nodeResolve(),
        json(),
        target ? esbuild({ target }) : esbuildPlugin
      ],
      external: [...externals, ...(external || [])]
    })

    if (dts !== false) {
      configs.push({
        input,
        output: {
          file: `packages/${name}/dist/${fn}.d.ts`,
          format: 'es'
        },
        plugins: dtsPlugin,
        external: [...externals, ...(external || [])]
      })
    }
  }
}

export default configs
