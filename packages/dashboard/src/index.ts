/**
 * @grafana-fast/dashboard 包入口
 *
 * 对外暴露内容包括：
 * - DashboardView：Dashboard 根组件（宿主应用可直接挂载）
 * - runtime：运行时注入 key、piniaAttachments 等（用于多实例隔离）
 * - stores：dashboard/timeRange/editor/tooltip 等 store（供 hooks 与宿主高级用法）
 * - types：透出 @grafana-fast/types（方便宿主应用一站式引用类型）
 *
 * 说明：
 * - 内部使用 `/#/` alias 组织源码路径；对外发布的 dist 不应依赖该 alias
 */
import '/#/assets/styles/global.less';
import type { App } from 'vue';
import DashboardView from '/#/components/Dashboard/Dashboard.vue';

/**
 * Dashboard 根组件（可直接在宿主应用中使用）
 */
export { DashboardView };

/**
 * runtime 注入 key / registry 等稳定导出面
 */
export * from '/#/runtime/keys';
export * from '/#/runtime/piniaAttachments';

/**
 * 内置 store 导出（高级用法：宿主可直接访问状态）
 */
export * from '/#/stores/dashboard';
export * from '/#/stores/timeRange';
export * from '/#/stores/editor';
export * from '/#/stores/tooltip';

/**
 * 主题相关 API
 */
export * from '/#/api/theme';

/**
 * JSON 严格校验器（可选，供宿主/演示页面复用）
 */
export * from '/#/utils/strictJsonValidators';

/**
 * 透出公共类型（为了让宿主应用更方便地引用 dashboard JSON/types）
 */
export * from '@grafana-fast/types';

/**
 * Vue 插件安装入口（可选）
 * - 注册全局组件 GrafanaFastDashboard
 */
export const install = (app: App) => {
  app.component('GrafanaFastDashboard', DashboardView);
  return app;
};

export default DashboardView;
