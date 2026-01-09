import '/#/assets/styles/global.less';
import type { App } from 'vue';
import MockButton from '/#/components/Common/MockButton.vue';
export * from '/#/components-common';

export { MockButton };
export * from '/#/stores/dashboard';
export * from '/#/stores/timeRange';
export * from '/#/stores/editor';
export * from '/#/stores/tooltip';
export * from '@grafana-fast/types';

export const install = (app: App) => {
  app.component('GrafanaFastButton', MockButton);
  return app;
};

export default MockButton;
