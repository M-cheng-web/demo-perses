# 快速开始

## 安装与工作区

```bash
pnpm install
# 启动演示站点
pnpm dev
# 构建全部包（types -> store -> component -> hooks）
pnpm run build:packages
```

工作区结构：

- `packages/component`：对外暴露的 Dashboard 组件和内部 store。
- `packages/hooks`：`useDashboardSdk` 等组合式 API。
- `packages/types`：公共类型、枚举、接口声明。
- `packages/app`：演示站点，消费上面三个包。
- `packages/docs`：VitePress 文档。

## NPM 包使用示例

```bash
pnpm add @grafana-fast/component @grafana-fast/hooks @grafana-fast/types
```

在你的应用里挂载 `@grafana-fast/store` 和 Ant Design Vue 后即可使用：

```ts
import { createApp } from 'vue';
import { createPinia } from '@grafana-fast/store';
import Antd from 'ant-design-vue';
import App from './App.vue';

createApp(App).use(createPinia()).use(Antd).mount('#app');
```
