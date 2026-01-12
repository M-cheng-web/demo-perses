import { createApp } from 'vue';
import { createPinia } from '@grafana-fast/store';
import App from './App.vue';
import router from './router';
import GrafanaFastUI from '@grafana-fast/component';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).use(GrafanaFastUI).mount('#app');
