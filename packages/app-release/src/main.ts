/**
 * 离线消费演示入口：创建 Vue App，并安装 ant-design-vue（作为宿主侧依赖示例）。
 */
import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';

createApp(App).use(Antd).mount('#app');
