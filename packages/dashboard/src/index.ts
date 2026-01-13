import '/#/assets/styles/global.less';
import type { App } from 'vue';
import DashboardView from '/#/components/Dashboard/Dashboard.vue';

export { DashboardView };
export * from '/#/stores/dashboard';
export * from '/#/stores/timeRange';
export * from '/#/stores/editor';
export * from '/#/stores/tooltip';
export * from '/#/api/theme';
export * from '@grafana-fast/types';

export const install = (app: App) => {
  app.component('GrafanaFastDashboard', DashboardView);
  return app;
};

export default DashboardView;
