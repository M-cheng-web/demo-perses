import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Grafana Fast Monorepo',
  description: 'Documentation for @grafana-fast/monorepo packages.',
  srcDir: '.',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: 'SDK', link: '/sdk/dashboard-sdk' },
      { text: '组件', link: '/components/dashboard' },
      { text: '主题', link: '/guide/themes' }
    ],
    sidebar: {
      '/guide/': [
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '工作区说明', link: '/guide/workspaces' },
        { text: '发布形态校验', link: '/guide/distribution' },
        { text: '主题与 Tokens', link: '/guide/themes' },
        { text: 'AntD Tokens 注入', link: '/guide/antd-tokens' }
      ],
      '/sdk/': [{ text: 'Dashboard SDK', link: '/sdk/dashboard-sdk' }],
      '/components/': [{ text: 'Dashboard 组件', link: '/components/dashboard' }]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/grafana-fast/monorepo' }]
  },
  vite: {}
});
