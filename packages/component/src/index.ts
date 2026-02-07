/**
 * @grafana-fast/component 包入口
 *
 * 说明：
 * - 这里统一导出所有 UI 组件，并提供 `install(app)` 作为 Vue 插件入口
 * - 业务侧可以按需 import 单个组件，也可以 app.use(Component) 全量注册
 */
import './styles';
import type { App, Component } from 'vue';

export * from './componentsExports';

export { message } from './message';
export * from './types';
export * from './composables/usePagination';
export * from './composables/useFloatingOverlay';
export * from './context/theme';
export * from './context/portal';
export { gfAntdTokensCssVar } from './theme/antdTokens';
export { default as gfAntdTokensCssVarJson } from './theme/antdTokens.cssvar.json';

import * as exportedComponents from './componentsExports';

// 避免因大量 SFC 导入导致的复杂递归类型推导（Volar `__VLS_WithSlots...`）
// 这里显式把 components 的元素类型拓宽为 Component。
const components: Component[] = Object.values(exportedComponents);

/**
 * Vue 插件安装入口：注册所有组件为全局组件
 */
export const install = (app: App) => {
  components.forEach((comp) => {
    const name = (comp as any).name;
    if (name) app.component(name, comp);
  });
  Object.entries(exportedComponents).forEach(([exportName, comp]) => {
    if (!exportName) return;
    app.component(exportName, comp);
  });
  return app;
};

export default {
  install,
};
