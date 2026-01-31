/**
 * ECharts 响应式调整 Composable
 * 参考 Perses 项目的图表自适应实现
 *
 * todo : window.addEventListener('resize' 这种应该创建集中的事件机制
 */

import { onUnmounted, type Ref } from 'vue';
import type { ComputedRef } from 'vue';
import type { ResizeOpts } from 'echarts/core';
import { subscribeWindowResize } from '/#/runtime/windowEvents';
import { debounceCancellable } from '@grafana-fast/utils';

export interface ResizableChartInstance {
  isDisposed: () => boolean;
  resize: (opts?: ResizeOpts) => void;
}

/**
 * 使 ECharts 图表自动响应容器大小变化
 * @param chartInstance - ECharts 实例的 ref
 * @param chartRef - 图表容器元素的 ref
 */
export function useChartResize(
  chartInstance: Ref<ResizableChartInstance | null> | ComputedRef<ResizableChartInstance | null>,
  chartRef: Ref<HTMLElement | undefined>
) {
  let resizeObserver: ResizeObserver | null = null;
  let animationFrameId: number | null = null;
  let unsubscribeWindowResize: null | (() => void) = null;
  let initTimeoutId: number | null = null;

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

  // 使用防抖避免频繁触发（可取消，避免卸载后仍触发）
  const debouncedResize = debounceCancellable(handleResize, 50); // 50ms 延迟，平衡响应速度和性能

  /**
   * 初始化图表 resize
   * 需要在图表初始化后调用
   */
  function initChartResize() {
    // 需要延迟1s再初始化，确保容器大小已确定
    if (initTimeoutId !== null) {
      clearTimeout(initTimeoutId);
    }
    initTimeoutId = window.setTimeout(() => {
      initTimeoutId = null;
      // 监听窗口 resize（集中管理，避免多实例重复绑定）
      unsubscribeWindowResize?.();
      unsubscribeWindowResize = subscribeWindowResize(debouncedResize);

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
    unsubscribeWindowResize?.();
    unsubscribeWindowResize = null;

    debouncedResize.cancel();

    if (initTimeoutId !== null) {
      clearTimeout(initTimeoutId);
      initTimeoutId = null;
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
