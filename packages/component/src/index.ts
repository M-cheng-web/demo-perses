import '/#/assets/styles/global.less';
import type { App } from 'vue';
import Dashboard from '/#/components/Dashboard/Dashboard.vue';

export { Dashboard };
export * from '/#/stores/dashboard';
export * from '/#/stores/timeRange';
export * from '/#/stores/editor';
export * from '/#/stores/tooltip';
export * from '@grafana-fast/types';

export const install = (app: App) => {
  app.component('GrafanaDashboard', Dashboard);
  return app;
};

export default Dashboard;
