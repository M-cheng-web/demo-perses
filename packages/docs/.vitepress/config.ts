/**
 * 文件说明：Docs 站点配置（VitePress）
 *
 * 这里主要维护侧边栏、导航等文档站点信息，方便新增架构/扩展点/JSON schema 等文档入口。
 */
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
      { text: '主题', link: '/guide/themes' },
    ],
    sidebar: {
      '/guide/': [
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '架构概览', link: '/guide/architecture' },
        { text: '工作区说明', link: '/guide/workspaces' },
        { text: '发布形态校验', link: '/guide/distribution' },
        { text: '主题与 Tokens', link: '/guide/themes' },
        { text: 'AntD Tokens 注入', link: '/guide/antd-tokens' },
        { text: 'Dashboard JSON', link: '/guide/dashboard-json' },
        { text: 'Panels 插件化', link: '/guide/panels' },
      ],
      '/sdk/': [
        { text: 'Dashboard SDK', link: '/sdk/dashboard-sdk' },
        { text: 'SDK 使用说明', link: '/sdk/dashboard-sdk-usage' },
        { text: '流程（方案A）', link: '/sdk/dashboard-sdk-plan-a' },
      ],
      '/components/': [{ text: 'Dashboard 组件', link: '/components/dashboard' }],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/grafana-fast/monorepo' }],
  },
  vite: {},
});
