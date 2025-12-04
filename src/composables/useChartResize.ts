/**
 * ECharts 响应式调整 Composable
 * 参考 Perses 项目的图表自适应实现
 *
 * todo : window.addEventListener('resize' 这种应该创建集中的事件机制
 */

import { onUnmounted, type Ref } from 'vue';
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
      if (chartInstance.value && !chartInstance.value.isDisposed() && chartRef.value) {
        try {
          // 获取容器的当前宽高，确保图表按照新的比例进行渲染
          const containerWidth = chartRef.value.offsetWidth;
          const containerHeight = chartRef.value.offsetHeight;

          chartInstance.value.resize({
            width: containerWidth,
            height: containerHeight,
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

  /**
   * 初始化图表 resize
   * 需要在图表初始化后调用
   */
  function initChartResize() {
    // 需要延迟1s再初始化，确保容器大小已确定
    setTimeout(() => {
      // 监听窗口 resize
      window.addEventListener('resize', debouncedResize);

      // 监听容器 resize（用于 grid-layout 拖拽调整大小）
      if (chartRef.value && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          debouncedResize();
        });
        resizeObserver.observe(chartRef.value);
      }

      // 首次初始化时不需要调用
      // if (chartInstance.value && !chartInstance.value.isDisposed()) {
      //   chartInstance.value.resize();
      // }
    }, 1000);
  }

  /**
   * 需要监听 chartInstance 变化，重新创建 observer
   */
  function watchChartInstance() {
    const newInstance = chartInstance.value;

    if (resizeObserver && chartRef.value) {
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
  }

  /**
   * 销毁图表 resize
   */
  function destroyChartResize() {
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
  }

  onUnmounted(() => {
    destroyChartResize();
  });

  return {
    initChartResize,
    watchChartInstance,
    destroyChartResize,
  };
}
