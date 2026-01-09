import { createApp } from 'vue';
import { createPinia } from '@grafana-fast/store';
import App from './App.vue';
import router from './router';
import Antd from 'ant-design-vue';

import 'ant-design-vue/dist/reset.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).use(Antd).mount('#app');
