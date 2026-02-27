/**
 * 类型补丁：为 `vue-grid-layout-v3` 提供最小声明（避免 TypeScript 在无官方类型时阻塞编译）。
 */
declare module 'vue-grid-layout-v3' {
  export const GridLayout: any;
  export const GridItem: any;
  const plugin: any;
  export default plugin;
}
