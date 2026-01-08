import { createApp, ref, type Ref, App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import Dashboard from '@grafana-fast/component/Dashboard';
import type { Dashboard as DashboardConfig } from '@grafana-fast/types';
import { useDashboardStore, useTimeRangeStore } from '@/stores';

export interface UseDashboardOptions {
  /**
   * 挂载容器元素
   */
  container: HTMLElement | Ref<HTMLElement | undefined>;

  /**
   * 初始仪表板配置
   */
  dashboard?: DashboardConfig;

  /**
   * 初始化完成回调
   */
  onMounted?: () => void;

  /**
   * 销毁回调
   */
  onUnmounted?: () => void;
}

export interface UseDashboardReturn {
  /**
   * Vue 应用实例
   */
  app: VueApp | null;

  /**
   * 挂载仪表板
   */
  mount: () => void;

  /**
   * 卸载仪表板
   */
  unmount: () => void;

  /**
   * 更新仪表板配置
   */
  updateDashboard: (config: Partial<DashboardConfig>) => void;

  /**
   * 获取当前仪表板配置
   */
  getDashboard: () => DashboardConfig | null;

  /**
   * 设置时间范围
   */
  setTimeRange: (from: string, to: string) => void;

  /**
   * 刷新数据
   */
  refresh: () => void;

  /**
   * 是否已挂载
   */
  isMounted: Ref<boolean>;
}

/**
 * useDashboard Hook
 *
 * 核心 Hook，用于将 Dashboard 组件挂载到指定的 DOM 元素上
 *
 * @example
 * ```ts
 * import { ref } from 'vue'
 * import { useDashboard } from '@grafana-fast/hooks'
 *
 * const containerRef = ref<HTMLElement>()
 *
 * const { mount, unmount, updateDashboard } = useDashboard({
 *   container: containerRef,
 *   dashboard: {
 *     id: 'my-dashboard',
 *     title: 'My Dashboard'
 *   }
 * })
 *
 * // 挂载
 * mount()
 *
 * // 更新配置
 * updateDashboard({ title: 'New Title' })
 *
 * // 卸载
 * unmount()
 * ```
 */
export function useDashboard(options: UseDashboardOptions): UseDashboardReturn {
  const { container, dashboard, onMounted, onUnmounted } = options;

  let app: VueApp | null = null;
  const isMounted = ref(false);

  /**
   * 获取容器元素
   */
  const getContainer = (): HTMLElement | null => {
    if (!container) return null;

    if ('value' in container) {
      return container.value || null;
    }

    return container;
  };

  /**
   * 挂载仪表板
   */
  const mount = () => {
    const el = getContainer();
    if (!el) {
      console.error('[useDashboard] Container element not found');
      return;
    }

    if (isMounted.value) {
      console.warn('[useDashboard] Dashboard already mounted');
      return;
    }

    // 创建 Vue 应用
    app = createApp(Dashboard);

    // 注册 Pinia
    const pinia = createPinia();
    app.use(pinia);

    // 注册 Ant Design Vue
    app.use(Antd);

    // 挂载
    app.mount(el);
    isMounted.value = true;

    // 初始化仪表板配置
    if (dashboard) {
      const dashboardStore = useDashboardStore(pinia);
      dashboardStore.initDashboard(dashboard);
    }

    // 回调
    onMounted?.();
  };

  /**
   * 卸载仪表板
   */
  const unmount = () => {
    if (!isMounted.value || !app) {
      console.warn('[useDashboard] Dashboard not mounted');
      return;
    }

    app.unmount();
    app = null;
    isMounted.value = false;

    // 回调
    onUnmounted?.();
  };

  /**
   * 更新仪表板配置
   */
  const updateDashboard = (config: Partial<DashboardConfig>) => {
    if (!isMounted.value || !app) {
      console.warn('[useDashboard] Dashboard not mounted');
      return;
    }

    const dashboardStore = useDashboardStore(app.config.globalProperties.$pinia);
    dashboardStore.updateDashboard(config);
  };

  /**
   * 获取当前仪表板配置
   */
  const getDashboard = (): DashboardConfig | null => {
    if (!isMounted.value || !app) {
      return null;
    }

    const dashboardStore = useDashboardStore(app.config.globalProperties.$pinia);
    return dashboardStore.dashboard;
  };

  /**
   * 设置时间范围
   */
  const setTimeRange = (from: string, to: string) => {
    if (!isMounted.value || !app) {
      console.warn('[useDashboard] Dashboard not mounted');
      return;
    }

    const timeRangeStore = useTimeRangeStore(app.config.globalProperties.$pinia);
    timeRangeStore.setTimeRange({ from, to });
  };

  /**
   * 刷新数据
   */
  const refresh = () => {
    if (!isMounted.value || !app) {
      console.warn('[useDashboard] Dashboard not mounted');
      return;
    }

    const dashboardStore = useDashboardStore(app.config.globalProperties.$pinia);
    dashboardStore.refresh();
  };

  return {
    app,
    mount,
    unmount,
    updateDashboard,
    getDashboard,
    setTimeRange,
    refresh,
    isMounted,
  };
}
