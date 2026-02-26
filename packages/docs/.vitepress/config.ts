/**
 * 文件说明：Docs 站点配置（VitePress）
 *
 * 说明：
 * - 仓库内更细的文档已收敛到各包的 README.md 与根目录 API_REQUIREMENTS.md
 * - 这里保留一个最小 docs 站点，便于本地快速预览（README 作为首页）
 */
export default {
  title: 'Grafana Fast Monorepo',
  description: 'Documentation for @grafana-fast/monorepo packages.',
  srcDir: '.',
  rewrites: {
    'README.md': 'index.md',
  },
  themeConfig: {
    nav: [{ text: 'README', link: '/' }],
    sidebar: [],
    socialLinks: [{ icon: 'github', link: 'https://github.com/grafana-fast/monorepo' }],
  },
  vite: {},
};
