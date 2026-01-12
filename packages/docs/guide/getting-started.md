# 快速开始

## 安装与工作区

```bash
pnpm install
# 启动演示站点
pnpm dev
# 构建全部包（types -> store -> component -> dashboard -> hooks）
pnpm build
```

工作区结构：

- `packages/component`：全新 UI 组件库（蓝色科技风），提供按钮、表单、表格等基础组件。
- `packages/dashboard`：Dashboard 体验包与内部 store。
- `packages/hook`：SDK hooks（包名为 `@grafana-fast/hooks`），提供 `useDashboardSdk` 等组合式 API。
- `packages/types`：公共类型、枚举、接口声明。
- `packages/app`：演示站点，消费上面三个包。
- `packages/docs`：VitePress 文档。

## NPM 包使用示例

```ts
import { createApp } from 'vue';
import { createPinia } from '@grafana-fast/store';
import GrafanaFastUI from '@grafana-fast/component';
import App from './App.vue';

createApp(App).use(createPinia()).use(GrafanaFastUI).mount('#app');
```

## 发布形态（dist）校验

默认 `pnpm dev` 为了开发体验会让演示站点直接指向各包源码。要模拟“真正发布后的消费形态”（走 `dist` + `exports`），可以：

```bash
# 构建产物（用于 dist/exports 形态的 smoke test）
pnpm build

# 用 dist/exports 形态启动演示站点
GF_USE_DIST=1 pnpm -C packages/app dev
```

## 组件按需导入

`@grafana-fast/component` 默认入口包含全量 `install` 与全局样式。若你希望更好的 tree-shaking（只打入用到的组件），建议改为：

```ts
import '@grafana-fast/component/styles';
import { Button } from '@grafana-fast/component/exports';
```
