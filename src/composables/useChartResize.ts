/**
 * ECharts 响应式调整 Composable
 */

import { onMounted, onUnmounted, type Ref } from 'vue';
import type { ECharts } from 'echarts';

/**
 * 使 ECharts 图表自动响应容器大小变化
 * @param chartInstance - ECharts 实例的 ref
 * @param chartRef - 图表容器元素的 ref
 */
export function useChartResize(
  chartInstance: Ref<ECharts | null>,
  chartRef: Ref<HTMLElement | undefined>
) {
  let resizeObserver: ResizeObserver | null = null;

  const handleResize = () => {
    if (chartInstance.value && !chartInstance.value.isDisposed()) {
      chartInstance.value.resize({
        animation: {
          duration: 300,
          easing: 'cubicOut',
        },
      });
    }
  };

  // 使用防抖避免频繁触发
  let timeoutId: number | null = null;
  const debouncedResize = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      handleResize();
      timeoutId = null;
    }, 50); // 减少延迟，更快响应
  };

  onMounted(() => {
    // 监听窗口 resize
    window.addEventListener('resize', debouncedResize);

    // 监听容器 resize（用于 grid-layout 拖拽调整大小）
    if (chartRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        debouncedResize();
      });
      resizeObserver.observe(chartRef.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('resize', debouncedResize);
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  return {
    handleResize,
  };
}

