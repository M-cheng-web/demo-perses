/**
 * 组件库内部 utils 入口：导出 bem/scrollLock，并复用 @grafana-fast/utils 的 timeout/debounce。
 */
export * from './bem';
export * from './scrollLock';
export { createTimeout, debounceCancellable } from '@grafana-fast/utils';
export type { TimeoutHandle } from '@grafana-fast/utils';
