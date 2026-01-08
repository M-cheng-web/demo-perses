export const packages: any[] = [
  {
    name: 'component',
    display: 'Component',
    description: 'Dashboard components for fast visualization',
    keywords: ['grafana-fast', 'dashboard', 'component', 'vue3'],
    iife: false,
    moduleJs: true, // main 入口指向 index.mjs
    singleChunk: true, // 子包单独打包
    external: ['@grafana-fast/hooks', '@grafana-fast/types'],
  },
  {
    name: 'hooks',
    display: 'Hooks',
    description: 'Core hooks for dashboard mounting and management',
    keywords: ['grafana-fast', 'hooks', 'dashboard', 'vue3'],
    external: ['@grafana-fast/types', '@grafana-fast/component'],
  },
  {
    name: 'types',
    display: 'Types',
    description: 'TypeScript type definitions',
    keywords: ['grafana-fast', 'types', 'typescript'],
    addon: true,
  },
];
