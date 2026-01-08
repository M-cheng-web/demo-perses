import { defineConfig, DefaultTheme } from 'vitepress'
import { version } from '../../package.json'
import { categoryNames, metadata } from '../metadata/metadata'

const GuideSidebar = sidebarGuide()
const CoreSidebar = sidebarCore()

export default defineConfig({
  lang: 'zh-CN',
  title: 'Grafana Fast',
  description: '基于 Vue 3 的快速仪表板可视化库',

  lastUpdated: true,
  base: '/grafana-fast',
  cleanUrls: 'without-subfolders',

  themeConfig: {
    logo: '/logo.svg',
    nav: nav(),

    sidebar: {
      '/guide/': GuideSidebar,
      '/hooks/': CoreSidebar,
      '/component/': CoreSidebar,
      '/types/': CoreSidebar,
      '/functions': CoreSidebar,
    } as DefaultTheme.Sidebar,

    editLink: {
      pattern: 'https://github.com/grafana-fast/grafana-fast/tree/main/packages/:path',
      text: '在 GitHub 上编辑此页'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/grafana-fast/grafana-fast' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present Grafana Fast'
    }
  },
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
  ]
})

// 顶部栏
function nav(): DefaultTheme.NavItem[] {
  return [
    { text: '开始', link: '/guide/introduce', activeMatch: '/guide/' },
    { text: '搜索', link: '/functions', activeMatch: '/functions/' },
    {
      text: version,
      link: ''
    }
  ]
}

// 其他tab侧边栏，例如 介绍
function sidebarGuide() {
  return [
    {
      text: '开始',
      items: [
        { text: '介绍', link: '/guide/introduce' },
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '分类说明', link: '/guide/categories' },
        { text: '搜索', link: '/functions' },
      ]
    },
    ...sidebarCore()
  ]
}

// 核心tab侧边栏
function sidebarCore() {
  return getCoreSideBar()
}

function getCoreSideBar() {
  const links: any[] = []

  for (const name of categoryNames) {
    if (name.startsWith('_')) continue

    const functions = metadata.functions.filter(i => i.category === name && !i.internal)

    links.push({
      text: name,
      items: functions.map(i => ({
        text: i.name,
        link: i.external || `/${i.package}/${i.name}/`,
      })),
      link: name.startsWith('@')
        ? functions[0].external || `/${functions[0].package}/README`
        : undefined,
    })
  }

  return links
}
