/**
 * Dashboard Runtime 注入 Key 定义（依赖注入的“协议”）
 *
 * 这些 key 用于在 Dashboard 组件树中注入/获取运行时依赖：
 * - API Client：数据访问层（mock/http/prometheus-direct），屏蔽后端变化
 * - RuntimeContext：当前 Dashboard 实例的运行时上下文（多实例隔离/事件作用域）
 *
 * 注意：
 * - 这是 @grafana-fast/dashboard 对外暴露的“运行时接口”之一，属于稳定导出面
 * - host 应用（或 hooks 包）通常在最外层 `provide(...)` 或通过 piniaAttachments 绑定
 */
import type { InjectionKey, Ref } from 'vue';
import type { GrafanaFastApiClient } from '@grafana-fast/api';

export interface DashboardRuntimeContext {
  /**
   * 当前 Dashboard 实例的唯一标识。
   *
   * 用途：
   * - 多实例隔离：例如同一页面挂载多个 dashboard 时，用于区分事件/缓存/调度器
   * - 调试：日志或 DevTools 中定位是哪一个实例
   */
  id: string;
  /**
   * Dashboard 根节点 DOM（如果可用）。
   *
   * 用途：
   * - 事件作用域：热键/鼠标跟踪等“全局事件”需要限定在某个 dashboard 范围内
   * - 在 Teleport（Modal/Drawer）场景下，有些事件需要其他策略兜底
   */
  rootEl?: Ref<HTMLElement | null>;
  /**
   * Dashboard 的滚动容器（如果可用）。
   *
   * 用途：
   * - “只刷新可视区域”与虚拟化：需要知道当前 viewport
   * - 多实例隔离：不要依赖 window/document 的全局滚动
   */
  scrollEl?: Ref<HTMLElement | null>;
}

/**
 * 注入：API Client（数据访问层）
 */
export const GF_API_KEY: InjectionKey<GrafanaFastApiClient> = Symbol('grafana-fast:api');
/**
 * 注入：Runtime Context（多实例上下文）
 */
export const GF_RUNTIME_KEY: InjectionKey<DashboardRuntimeContext> = Symbol('grafana-fast:runtime');
