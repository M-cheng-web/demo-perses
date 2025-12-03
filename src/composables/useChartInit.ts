import { ref, watch, onUnmounted, type Ref } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';

/**
 * 图表初始化 Hook
 * 用于处理异步数据就绪后的一次性初始化和后续更新
 * 内部管理 ECharts 实例的创建、更新和销毁
 */
export function useChartInit<T = ECharts>(options: {
  /** 图表 DOM 引用 */
  chartRef: Ref<HTMLElement | undefined>;
  /** 依赖项列表，只有当所有依赖都有效时才会初始化 */
  dependencies: {
    /** 依赖项的值 */
    value: Ref<any>;
    /** 判断依赖项是否有效的函数 */
    isValid: (val: any) => boolean;
  }[];
  /** ECharts 实例创建后的配置回调（可选） */
  onChartCreated?: (chartInstance: T) => void;
  /** 更新回调 */
  onUpdate: (chartInstance: T) => void;
  /** 初始化失败回调（可选） */
  onInitFailed?: () => void;
}) {
  const { chartRef, dependencies, onChartCreated, onUpdate, onInitFailed } = options;

  // 使用普通变量存储 ECharts 实例，避免响应式系统破坏其内部方法
  let chartInstance: T | null = null;

  const isInitialized = ref(false);
  const isLoading = ref(true);
  const isInitializing = ref(false); // 防止重复初始化

  /**
   * 检查所有依赖是否都已就绪
   */
  const areAllDependenciesReady = (): boolean => {
    if (!chartRef.value) {
      return false;
    }

    return dependencies.every((dep) => dep.isValid(dep.value.value));
  };

  /**
   * 初始化 ECharts 实例
   */
  const initChartInstance = async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!chartRef.value) {
        console.warn('[useChartInit] Chart ref is not ready');
        reject(false);
      }

      try {
        setTimeout(() => {
          // 创建 ECharts 实例 - 存储在普通变量中
          chartInstance = echarts.init(chartRef.value) as T;

          // 执行自定义配置回调（例如绑定事件）
          if (onChartCreated && chartInstance) {
            onChartCreated(chartInstance);
          }
          resolve(true);
        }, 1000);
      } catch (error) {
        console.error('[useChartInit] Failed to initialize chart instance:', error);
        reject(false);
      }
    });
  };

  /**
   * 监听所有依赖的变化
   */
  watch(
    [chartRef, ...dependencies.map((dep) => dep.value)],
    async () => {
      const allReady = areAllDependenciesReady();

      // 如果还未初始化、未在初始化中，且所有依赖都已就绪，执行初始化
      if (!isInitialized.value && !isInitializing.value && allReady) {
        isInitializing.value = true;

        try {
          const success = await initChartInstance();

          if (success && chartInstance) {
            isInitialized.value = true;
            isLoading.value = false;
            // 初始化成功后立即执行一次更新
            onUpdate(chartInstance);
          } else {
            isLoading.value = false;
            onInitFailed?.();
          }
        } catch (error) {
          console.error('[useChartInit] Initialization error:', error);
          isLoading.value = false;
          onInitFailed?.();
        } finally {
          isInitializing.value = false;
        }
        return;
      }

      // 如果已经初始化，只执行更新
      if (isInitialized.value && allReady && chartInstance) {
        onUpdate(chartInstance);
      }
    },
    { deep: true, immediate: true }
  );

  /**
   * 组件卸载时清理 ECharts 实例
   */
  onUnmounted(() => {
    if (chartInstance) {
      (chartInstance as unknown as ECharts).dispose();
      chartInstance = null;
    }
  });

  /**
   * 获取 ECharts 实例（原始对象，无响应式包装）
   */
  const getInstance = (): T | null => {
    return chartInstance;
  };

  return {
    /** 获取原始 ECharts 实例的方法 */
    getInstance,
    /** 是否已初始化 */
    isInitialized,
    /** 是否正在加载 */
    isLoading,
    /** 是否正在初始化中 */
    isInitializing,
  };
}
