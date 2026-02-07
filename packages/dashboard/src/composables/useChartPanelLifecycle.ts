import { computed, nextTick, type Ref } from 'vue';
import type { ECharts } from 'echarts';
import { useChartInit } from './useChartInit';
import { useChartResize, type ResizableChartInstance } from './useChartResize';

interface UseChartPanelLifecycleOptions<T extends ResizableChartInstance> {
  chartRef: Ref<HTMLElement | undefined>;
  queryResults: Ref<unknown>;
  panelOptions: Ref<unknown>;
  onChartCreated: (instance: T) => void;
  onChartUpdated: (instance: T) => void;
  initResizeOnCreated?: boolean;
}

/**
 * 将图表组件中重复的“初始化 + 首次渲染 + resize 绑定 + 后续更新”流程收敛到一个组合式 Hook。
 */
export function useChartPanelLifecycle<T extends ResizableChartInstance = ECharts>(options: UseChartPanelLifecycleOptions<T>) {
  let scheduleInitResize: (() => void) | null = null;

  const { getInstance } = useChartInit<T>({
    chartRef: options.chartRef,
    dependencies: [
      {
        value: options.queryResults,
        isValid: (val: unknown) => Array.isArray(val),
      },
      {
        value: options.panelOptions,
        // Options can be an empty object; charts should still render with defaults.
        isValid: (val: unknown) => val != null,
      },
    ],
    onChartCreated: (instance) => {
      nextTick(() => {
        options.onChartCreated(instance);
        if (options.initResizeOnCreated !== false) {
          scheduleInitResize?.();
        }
      });
    },
    onUpdate: (instance) => {
      nextTick(() => {
        options.onChartUpdated(instance);
      });
    },
  });

  const { initChartResize } = useChartResize(
    computed(() => getInstance()),
    options.chartRef
  );
  scheduleInitResize = initChartResize;

  return {
    getInstance,
    initChartResize,
  };
}
