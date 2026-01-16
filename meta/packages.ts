/**
 * Monorepo 子包元信息列表
 *
 * 用途：
 * - 给 scripts/build.ts / scripts/publish.ts 等脚本提供统一的包清单
 * - 描述每个子包的发布信息、构建方式、external 依赖等
 *
 * 说明：
 * - 这里只维护“仓库级别的配置”，不放具体业务逻辑
 */
import path from 'path';
import { packagesDir } from './paths.js';

export type PackageCategory = 'library' | 'app' | 'docs';

export interface PackageMeta {
  /**
   * `packages/` 下的目录名（例如 "hook", "store"）。
   */
  name: string;
  /**
   * 对外发布的 npm 包名（如果有，例如 "@grafana-fast/hooks"）。
   */
  packageName?: string;
  display: string;
  description: string;
  category: PackageCategory;
  /**
   * 是否参与打包/发布流水线。
   */
  publish?: boolean;
  /**
   * 当该包使用 Rollup 构建时的 external 列表。
   *（如果是 Vite 构建，这个字段可能不会生效。）
   */
  external?: string[];
}

export const packages: PackageMeta[] = [
  {
    name: 'json-editor',
    packageName: '@grafana-fast/json-editor',
    display: 'JSON Editor',
    description: '轻量 JSON 编辑器（导入/导出 + 诊断 + 严格校验阻断）。',
    category: 'library',
    publish: true,
    external: ['vue', '@grafana-fast/component', '@grafana-fast/types', 'jsonc-parser'],
  },
  {
    name: 'api',
    packageName: '@grafana-fast/api',
    display: 'API',
    description: 'grafana-fast 的数据访问层（契约层 + 实现层）。',
    category: 'library',
    publish: true,
    external: ['@grafana-fast/types'],
  },
  {
    name: 'types',
    packageName: '@grafana-fast/types',
    display: '类型',
    description: 'grafana-fast 的公共类型定义。',
    category: 'library',
    publish: true,
  },
  {
    name: 'store',
    packageName: '@grafana-fast/store',
    display: '状态管理',
    description: '为 grafana-fast 提供的轻量级状态管理（类似 Pinia）。',
    category: 'library',
    publish: true,
    external: ['vue'],
  },
  {
    name: 'component',
    packageName: '@grafana-fast/component',
    display: '组件库',
    description: 'grafana-fast 仪表板使用的 UI 组件库。',
    category: 'library',
    publish: true,
    external: ['vue', '@ant-design/icons-vue'],
  },
  {
    name: 'dashboard',
    packageName: '@grafana-fast/dashboard',
    display: '仪表板',
    description: 'grafana-fast 的仪表板体验包。',
    category: 'library',
    publish: true,
    external: ['vue', 'echarts', '@grafana-fast/api'],
  },
  {
    name: 'hook',
    packageName: '@grafana-fast/hooks',
    display: 'Hooks',
    description: '与 grafana-fast 仪表板交互的组合式 Hooks（SDK）。',
    category: 'library',
    publish: true,
    external: ['vue', '@grafana-fast/store', '@grafana-fast/dashboard', '@grafana-fast/types', '@grafana-fast/api'],
  },
  {
    name: 'app',
    packageName: '@grafana-fast/app',
    display: '演示站点',
    description: '用于联调与演示的站点（消费工作区内的各子包）。',
    category: 'app',
    publish: false,
  },
  {
    name: 'docs',
    packageName: '@grafana-fast/docs',
    display: '文档',
    description: 'VitePress 文档站点。',
    category: 'docs',
    publish: false,
  },
];

export const publishPackages = packages.filter((pkg) => pkg.category === 'library' && pkg.publish);

export function resolvePackageDir(name: string) {
  return path.join(packagesDir, name);
}
