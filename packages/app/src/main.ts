/**
 * 演示站点入口：创建 Vue App 并安装 pinia/router 与 @grafana-fast/component。
 */
import { createApp } from 'vue';
import { createPinia } from '@grafana-fast/store';
import App from './App.vue';
import router from './router';
import GrafanaFastUI from '@grafana-fast/component';

void (async () => {
  // mode=production 时，packages/app 会消费各包 dist 产物。
  // 由于 component/dashboard 的样式会被抽取为独立 css 文件，这里需要显式引入。
  if (import.meta.env.MODE === 'production') {
    await import('./distStyles');
  }

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia).use(router).use(GrafanaFastUI).mount('#app');
})();
