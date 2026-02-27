/**
 * Portal 上下文：为浮层组件提供 Teleport target（由 ConfigProvider 注入）。
 */
import type { ComputedRef, InjectionKey } from 'vue';

export interface GfPortalContext {
  /**
   * 浮层 Teleport 目标容器（Modal/Drawer/Dropdown/Select/Tooltip/Popconfirm 等）。
   *
   * - 默认：`body`
   * - 由 ConfigProvider 提供时：`.gf-portal-root` 元素
   */
  target: ComputedRef<string | HTMLElement>;
}

export const GF_PORTAL_CONTEXT_KEY: InjectionKey<GfPortalContext> = Symbol('GF_PORTAL_CONTEXT_KEY');
