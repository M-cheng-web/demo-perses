/**
 * 图表 Tooltip 注册管理 Hook
 * 用于统一管理图表到全局 Tooltip 系统的注册、更新和销毁
 *
 * @example
 * ```typescript
 * // 业务代码只需从这个文件导入所有需要的类型和功能
 * import { useChartTooltip, TooltipDataProviders, type ChartRegistration } from '/#/composables/useChartTooltip';
 * ```
 */

import { onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { ECharts } from 'echarts';
import { useTooltipStore } from '/#/stores';
import type {
  ChartRegistration as StoreChartRegistration,
  MousePosition as StoreMousePosition,
  TooltipData as StoreTooltipData,
  TooltipSeriesItem as StoreTooltipSeriesItem,
} from '/#/stores/tooltip';
import type { TimeSeriesData, QueryResult } from '@grafana-fast/types';

/**
 * 重新导出 Store 中定义的类型，供业务代码使用
 * 业务代码应该从这里导入，而不是直接从 /#/stores 导入
 */
export type ChartRegistration = StoreChartRegistration;
export type MousePosition = StoreMousePosition;
export type TooltipData = StoreTooltipData;
export type TooltipSeriesItem = StoreTooltipSeriesItem;

/**
 * Tooltip 数据提供者接口
 * 用于支持不同类型图表的数据格式
 */
export interface TooltipDataProvider<T = any> {
  /**
   * 获取图表数据
   */
  getData: () => T;

  /**
   * 获取格式化选项
   */
  getFormatOptions?: () => any;

  /**
   * 判断指定系列是否可见
   */
  isSeriesVisible?: (seriesId: string) => boolean;

  /**
   * 自定义数据转换器（可选）
   * 用于将特定图表的数据格式转换为 Tooltip 系统需要的格式
   */
  transformData?: (data: T) => TimeSeriesData[];
}

/**
 * Tooltip 注册配置
 */
export interface TooltipRegistrationOptions<T = any> {
  /**
   * 图表唯一标识
   */
  chartId: string | Ref<string> | ComputedRef<string>;

  /**
   * 图表实例
   */
  chartInstance: Ref<ECharts | null> | ComputedRef<ECharts | null>;

  /**
   * 图表容器元素引用
   */
  chartContainerRef: Ref<HTMLElement | undefined>;

  /**
   * 数据提供者
   */
  dataProvider: TooltipDataProvider<T>;

  /**
   * 是否启用自动注册（默认：true）
   */
  enabled?: Ref<boolean> | ComputedRef<boolean> | boolean;

  /**
   * 自定义容器选择器类名（默认：'.time-series-chart'）
   * 用于全局事件监听时识别图表
   */
  containerClassName?: string;

  /**
   * 注册前的钩子（可选）
   * 返回 false 可阻止注册
   */
  beforeRegister?: (registration: ChartRegistration) => boolean | void;

  /**
   * 注册后的钩子（可选）
   */
  afterRegister?: (registration: ChartRegistration) => void;

  /**
   * 取消注册前的钩子（可选）
   */
  beforeUnregister?: (chartId: string) => void;

  /**
   * 取消注册后的钩子（可选）
   */
  afterUnregister?: (chartId: string) => void;
}

/**
 * 图表 Tooltip 注册管理 Hook
 *
 * @example
 * ```typescript
 * // 时间序列图表
 * useChartTooltip({
 *   chartId: computed(() => `chart-${props.panel.id}`),
 *   chartInstance: chartInstance,
 *   chartContainerRef: chartRef,
 *   dataProvider: {
 *     getData: () => timeSeriesData.value,
 *     getFormatOptions: () => props.panel.options.format,
 *     isSeriesVisible: isSeriesSelected,
 *   },
 * });
 *
 * // 柱状图（自定义数据转换）
 * useChartTooltip({
 *   chartId: computed(() => `bar-chart-${props.panel.id}`),
 *   chartInstance: chartInstance,
 *   chartContainerRef: chartRef,
 *   dataProvider: {
 *     getData: () => barChartData.value,
 *     transformData: (data) => convertBarDataToTimeSeries(data),
 *   },
 *   containerClassName: 'bar-chart',
 * });
 * ```
 */
export function useChartTooltip<T = TimeSeriesData[]>(options: TooltipRegistrationOptions<T>) {
  const {
    chartId,
    chartInstance,
    chartContainerRef,
    dataProvider,
    enabled = true,
    containerClassName,
    beforeRegister,
    afterRegister,
    beforeUnregister,
    afterUnregister,
  } = options;

  const tooltipStore = useTooltipStore();

  /**
   * 获取当前的 chartId 值
   */
  const getChartId = (): string => {
    return typeof chartId === 'string' ? chartId : chartId.value;
  };

  /**
   * 检查是否启用
   */
  const isEnabled = (): boolean => {
    return typeof enabled === 'boolean' ? enabled : enabled.value;
  };

  /**
   * 获取图表实例
   */
  const getChartInstance = (): ECharts | null => {
    return chartInstance.value;
  };

  /**
   * 获取容器元素
   */
  const getContainerElement = (): HTMLElement | undefined => {
    return chartContainerRef.value;
  };

  /**
   * 转换数据为 Tooltip 系统需要的格式
   */
  const getTransformedData = (): TimeSeriesData[] => {
    const rawData = dataProvider.getData();

    if (dataProvider.transformData) {
      return dataProvider.transformData(rawData);
    }

    // 默认情况下，假设数据已经是 TimeSeriesData[] 格式
    return rawData as TimeSeriesData[];
  };

  /**
   * 构建注册信息
   */
  const buildRegistration = (): ChartRegistration => {
    const instance = getChartInstance();
    const container = getContainerElement();

    // 如果设置了自定义容器类名，确保容器元素有该类名
    if (containerClassName && container && !container.classList.contains(containerClassName)) {
      container.classList.add(containerClassName);
    }

    const registration: ChartRegistration = {
      chartId: getChartId(),
      chartInstance: instance,
      data: getTransformedData(),
      formatOptions: dataProvider.getFormatOptions?.(),
      isSeriesVisible: dataProvider.isSeriesVisible,
      containerElement: container,
    };

    return registration;
  };

  /**
   * 绑定 ECharts ZRender 事件（如果是 ECharts 实例）
   */
  const bindEChartsEvents = (instance: any, _container: HTMLElement) => {
    // 检查是否是 ECharts 实例（是否有 getZr 方法）
    if (!instance || typeof instance.getZr !== 'function') {
      return;
    }

    const zr = instance.getZr();
    if (!zr) return;

    const chartId = getChartId();

    // 鼠标移动事件（设置活跃图表，位置由 Dashboard 全局管理）
    const mousemoveListener = () => {
      tooltipStore.setActiveChart(chartId);
    };

    // 鼠标离开事件
    const mouseoutListener = (params: any) => {
      if (params.type !== 'globalout' && params.target) return;
      tooltipStore.handleMouseLeave(chartId);
    };

    // 点击事件（固定/取消固定）
    const clickListener = (params: any) => {
      const { offsetX, offsetY, event } = params;
      const position: MousePosition = {
        x: offsetX,
        y: offsetY,
        pageX: event.pageX,
        pageY: event.pageY,
      };

      tooltipStore.togglePin(chartId, position);
    };

    // 绑定事件
    zr.on('mousemove', mousemoveListener);
    // zr.on('mousemove', mouseoutListener);
    zr.on('globalout', mouseoutListener);
    zr.on('click', clickListener);

    // 保存事件监听器引用，用于后续清理
    (instance as any).__tooltipListeners__ = {
      mousemove: mousemoveListener,
      // mouseout: mouseoutListener,
      globalout: mouseoutListener,
      click: clickListener,
    };
  };

  /**
   * 解绑 ECharts ZRender 事件
   */
  const unbindEChartsEvents = () => {
    const instance = getChartInstance();
    if (!instance || typeof instance.getZr !== 'function') {
      return;
    }

    const zr = instance.getZr();
    const listeners = (instance as any).__tooltipListeners__;

    if (zr && listeners) {
      zr.off('mousemove', listeners.mousemove);
      zr.off('mouseout', listeners.mouseout);
      zr.off('click', listeners.click);
      delete (instance as any).__tooltipListeners__;
    }
  };

  /**
   * 注册图表到 Tooltip 系统
   */
  const registerChart = () => {
    if (!isEnabled()) {
      return;
    }

    const instance = getChartInstance();
    const container = getContainerElement();

    // 确保图表实例和容器元素都已准备好
    if (!instance || !container) {
      return;
    }

    const registration = buildRegistration();

    // 执行注册前钩子
    if (beforeRegister) {
      const shouldContinue = beforeRegister(registration);
      if (shouldContinue === false) {
        return;
      }
    }

    // 注册到 Store
    tooltipStore.registerChart(registration);

    // 绑定 ECharts 事件（如果是 ECharts 实例）
    bindEChartsEvents(instance, container);

    // 执行注册后钩子
    if (afterRegister) {
      afterRegister(registration);
    }
  };

  /**
   * 更新已注册的图表信息
   */
  const updateRegistration = () => {
    if (!isEnabled()) {
      return;
    }

    const instance = getChartInstance();
    if (!instance) {
      return;
    }

    tooltipStore.updateChartRegistration(getChartId(), {
      data: getTransformedData(),
      formatOptions: dataProvider.getFormatOptions?.(),
      isSeriesVisible: dataProvider.isSeriesVisible,
    });
  };

  /**
   * 取消注册
   */
  const unregisterChart = () => {
    const id = getChartId();

    // 执行取消注册前钩子
    if (beforeUnregister) {
      beforeUnregister(id);
    }

    // 解绑事件
    unbindEChartsEvents();

    // 从 Store 取消注册
    tooltipStore.unregisterChart(id);

    // 执行取消注册后钩子
    if (afterUnregister) {
      afterUnregister(id);
    }
  };

  /**
   * 组件卸载时自动取消注册
   */
  onUnmounted(() => {
    unregisterChart();
  });

  /**
   * 更新 Tooltip 数据（供 formatter 或自定义逻辑调用）
   */
  const updateTooltipData = (data: TooltipData | null, position?: MousePosition) => {
    tooltipStore.updateTooltipData(getChartId(), data, position);
  };

  /**
   * 返回暴露的 API
   */
  return {
    /**
     * 手动注册图表
     */
    register: registerChart,

    /**
     * 手动更新注册信息
     */
    update: updateRegistration,

    /**
     * 手动取消注册
     */
    unregister: unregisterChart,

    /**
     * 更新 Tooltip 展示数据
     * 通常在 ECharts 的 tooltip.formatter 中调用
     */
    updateTooltipData,

    /**
     * 获取当前图表ID
     */
    getChartId,

    /**
     * 检查图表是否已注册
     */
    isRegistered: () => {
      return tooltipStore.getChartRegistration(getChartId()) !== undefined;
    },

    /**
     * 检查当前图表是否为固定的图表
     */
    isPinned: () => {
      return tooltipStore.isChartPinned(getChartId());
    },

    /**
     * 切换固定状态
     */
    togglePin: () => {
      tooltipStore.togglePin(getChartId());
    },
  };
}

/**
 * 预设的数据提供者工厂函数
 */
export const TooltipDataProviders = {
  /**
   * 时间序列数据提供者
   */
  timeSeries: (
    getData: () => TimeSeriesData[],
    getFormatOptions?: () => any,
    isSeriesVisible?: (seriesId: string) => boolean
  ): TooltipDataProvider<TimeSeriesData[]> => ({
    getData,
    getFormatOptions,
    isSeriesVisible,
  }),

  /**
   * 柱状图数据提供者
   * 将 QueryResult 转换为 TimeSeriesData[]
   */
  bar: (
    getQueryResults: () => QueryResult[],
    getFormatOptions?: () => any,
    isSeriesVisible?: (seriesId: string) => boolean
  ): TooltipDataProvider<QueryResult[]> => ({
    getData: getQueryResults,
    getFormatOptions,
    isSeriesVisible,
    transformData: (queryResults: QueryResult[]) => {
      // 将 QueryResult[] 转换为 TimeSeriesData[]
      return queryResults.flatMap((result) => result.data || []);
    },
  }),

  /**
   * 饼图数据提供者
   * 将 QueryResult 转换为 TimeSeriesData[]
   */
  pie: (
    getQueryResults: () => QueryResult[],
    getFormatOptions?: () => any,
    isSeriesVisible?: (seriesId: string) => boolean
  ): TooltipDataProvider<QueryResult[]> => ({
    getData: getQueryResults,
    getFormatOptions,
    isSeriesVisible,
    transformData: (queryResults: QueryResult[]) => {
      // 将 QueryResult[] 转换为 TimeSeriesData[]
      return queryResults.flatMap((result) => result.data || []);
    },
  }),

  /**
   * 自定义数据提供者
   */
  custom: <T>(
    getData: () => T,
    transformData: (data: T) => TimeSeriesData[],
    getFormatOptions?: () => any,
    isSeriesVisible?: (seriesId: string) => boolean
  ): TooltipDataProvider<T> => ({
    getData,
    transformData,
    getFormatOptions,
    isSeriesVisible,
  }),
};
