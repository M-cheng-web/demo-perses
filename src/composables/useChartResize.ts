/**
 * ECharts 响应式调整 Composable
 * 参考 Perses 项目的图表自适应实现
 */

import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import type { EChartsType } from 'echarts/core';

/**
 * 使 ECharts 图表自动响应容器大小变化
 * @param chartInstance - ECharts 实例的 ref
 * @param chartRef - 图表容器元素的 ref
 */
export function useChartResize(
  chartInstance: Ref<EChartsType | null | { isDisposed: () => boolean; resize: (opts?: any) => void }>,
  chartRef: Ref<HTMLElement | undefined>
) {
  let resizeObserver: ResizeObserver | null = null;
  let animationFrameId: number | null = null;

  const handleResize = () => {
    // 使用 requestAnimationFrame 优化性能，避免在动画期间频繁resize
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = requestAnimationFrame(() => {
      if (chartInstance.value && !chartInstance.value.isDisposed()) {
        try {
          chartInstance.value.resize({
            animation: {
              duration: 300,
              easing: 'cubicOut',
            },
          });
        } catch (error) {
          console.warn('Error resizing chart:', error);
        }
      }
      animationFrameId = null;
    });
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
    }, 50); // 50ms 延迟，平衡响应速度和性能
  };

  // 监听 chartInstance 变化，重新创建 observer
  watch(chartInstance, (newInstance, oldInstance) => {
    if (oldInstance && resizeObserver && chartRef.value) {
      resizeObserver.unobserve(chartRef.value);
    }

    if (newInstance && !newInstance.isDisposed() && chartRef.value && typeof ResizeObserver !== 'undefined') {
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          debouncedResize();
        });
      }
      resizeObserver.observe(chartRef.value);
    }
  });

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

    // 延迟初始化 resize，确保容器大小已确定
    setTimeout(() => {
      if (chartInstance.value && !chartInstance.value.isDisposed()) {
        chartInstance.value.resize();
      }
    }, 100);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', debouncedResize);

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
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
