import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'src',
  title: "Vue3 Grid Layout",
  description: "A draggable and resizable grid layout, as a Vue component.",
  markdown: {
    theme: 'monokai',
    lineNumbers: true,
  },
  cleanUrls: true,
  base: "/vue-grid-layout-v3/",
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../src/', import.meta.url)),
      },
    },
    ssr: {
      noExternal: ['vue-grid-layout-v3'],
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.png',
    repo: 'merfais/vue-grid-layout-v3',
    head: [
      ['link', { rel: 'icon', href: '/favicon.ico' }],
    ],
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Installation', link: '/guide/' },
          { text: 'Usage', link: '/guide/usage' },
          { text: 'Properties', link: '/guide/properties' },
          { text: 'Events', link: '/guide/events' },
          { text: 'Styling', link: '/guide/styling' },
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: '01 - Basic', link: '/guide/01-basic' },
          { text: '02 - Move and resize events', link: '/guide/02-events' },
          { text: '03 - Multiple grids', link: '/guide/03-multiple-grids' },
          { text: '04 - Drag allow/ignore elements', link: '/guide/04-allow-ignore' },
          { text: '05 - Mirrored grid layout', link: '/guide/05-mirrored' },
          { text: '06 - Responsive', link: '/guide/06-responsive' },
          { text: '07 - Prevent Collision', link: '/guide/07-prevent-collision' },
          { text: '08 - Responsive with predefined layouts', link: '/guide/08-responsive-predefined-layouts' },
          { text: '09 - Dynamic Add/Remove', link: '/guide/09-dynamic-add-remove' },
          { text: '10 - Drag From Outside', link: '/guide/10-drag-from-outside' },
          { text: '11 - Dragging grid items bounded to grid container', link: '/guide/11-bounded' },
        ]
      }
    ],
    aside: false,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/merfais/vue-grid-layout-v3' }
    ],
    search: {
      provider: 'local',
      // options: {
      //   appId: 'vue_grid_layout',
      //   apiKey: '2f143d1edd24605564065dd02bf0a22b',
      //   indexName: 'vue_grid_layout'
      // }
    },
    editLink: {
      pattern: 'https://github.com/merfais/vue-grid-layout-v3/tree/master/website/src/:path',
      text: 'Edit this page on GitHub'
    },
    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    },
    externalLinkIcon: true,
  }
})
