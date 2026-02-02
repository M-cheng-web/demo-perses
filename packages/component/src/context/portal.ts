import type { ComputedRef, InjectionKey } from 'vue';

export interface GfPortalContext {
  /**
   * Teleport target for floating layers (Modal/Drawer/Dropdown/Select/Tooltip/Popconfirm...).
   *
   * - Default: `body`
   * - When provided by ConfigProvider: `.gf-portal-root` element
   */
  target: ComputedRef<string | HTMLElement>;
}

export const GF_PORTAL_CONTEXT_KEY: InjectionKey<GfPortalContext> = Symbol('GF_PORTAL_CONTEXT_KEY');

