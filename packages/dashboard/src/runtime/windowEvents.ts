/**
 * Compatibility re-export: window event hub
 *
 * 说明：
 * - 该实现已收敛到 `@grafana-fast/utils`（跨包复用，避免重复维护）
 * - dashboard 内部仍保留原 import 路径（`/#/runtime/windowEvents`），减少改动面
 */

export type { Unsubscribe } from '@grafana-fast/utils';
export { subscribeEvent, subscribeWindowEvent, subscribeWindowResize } from '@grafana-fast/utils';
