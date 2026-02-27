/**
 * Dashboard 运行时绑定：注入 runtime、绑定 apiClient、同步宿主容器尺寸与全局指针位置。
 */
import { computed, inject, onMounted, onUnmounted, provide, ref, watch, type ComputedRef, type Ref } from 'vue';
import { getActivePinia, type Pinia } from '@grafana-fast/store';
import type { GrafanaFastApiClient } from '@grafana-fast/api';
import { subscribeWindowResize } from '@grafana-fast/utils';

import { GF_RUNTIME_KEY } from '/#/runtime/keys';
import { setPiniaApiClient } from '/#/runtime/piniaAttachments';

type TooltipStoreLike = {
  updateGlobalMousePosition: (pos: { x: number; y: number; pageX: number; pageY: number }) => void;
};

interface Options {
  instanceId: ComputedRef<string>;
  rootEl: Ref<HTMLElement | null>;
  scrollEl: Ref<HTMLElement | null>;
  tooltipStore: TooltipStoreLike;
  apiClient?: GrafanaFastApiClient;
  onHostResize?: () => void;
}

export function useDashboardRuntimeBindings(options: Options) {
  // 注入运行时依赖（按 Dashboard 实例隔离）。
  provide(GF_RUNTIME_KEY, { id: options.instanceId.value, rootEl: options.rootEl, scrollEl: options.scrollEl });

  // 注意：inject() 必须在 setup 阶段调用（不能放到 onMounted 中）。
  const injectedPinia = inject<Pinia | undefined>('pinia', undefined);

  // 把 apiClient 绑定到 pinia：使 store（非组件模块）可访问实例级运行时依赖。
  // 注意：应在 setup/watch 阶段完成绑定（而不是 onMounted），以便 QueryScheduler 在 setup 中安全读取。
  const activePinia = injectedPinia ?? getActivePinia();
  watch(
    () => options.apiClient,
    (client) => {
      if (!activePinia || !client) return;
      setPiniaApiClient(activePinia, client);
    },
    { immediate: true }
  );

  // -------------------
  // 宿主容器高度同步
  // -------------------
  const hostHeightPx = ref<number | null>(null);
  let hostResizeObserver: ResizeObserver | null = null;
  let observedHostEl: HTMLElement | null = null;
  let unsubscribeWindowResize: null | (() => void) = null;

  const resolveHostEl = (): HTMLElement | null => options.rootEl.value?.parentElement ?? null;

  const updateHostHeight = () => {
    const host = resolveHostEl();
    if (!host) {
      hostHeightPx.value = null;
      options.onHostResize?.();
      return;
    }
    const next = Math.floor(host.clientHeight);
    hostHeightPx.value = next > 0 ? next : null;
    options.onHostResize?.();
  };

  const detachHostObserver = () => {
    if (hostResizeObserver) {
      hostResizeObserver.disconnect();
    }
    observedHostEl = null;
    unsubscribeWindowResize?.();
    unsubscribeWindowResize = null;
  };

  const attachHostObserver = () => {
    const host = resolveHostEl();
    if (!host || observedHostEl === host) {
      updateHostHeight();
      return;
    }

    detachHostObserver();
    observedHostEl = host;

    if (typeof ResizeObserver !== 'undefined') {
      hostResizeObserver = hostResizeObserver ?? new ResizeObserver(() => updateHostHeight());
      hostResizeObserver.observe(host);
    } else {
      unsubscribeWindowResize = subscribeWindowResize(updateHostHeight);
    }

    updateHostHeight();
  };

  const rootStyle = computed(() => {
    const style: Record<string, string> = {};
    if (hostHeightPx.value && hostHeightPx.value > 0) {
      style.height = `${hostHeightPx.value}px`;
      style['--dp-dashboard-host-height'] = `${hostHeightPx.value}px`;
    }
    return style;
  });

  // ---------------------
  // 指针追踪（全局 Tooltip）
  // ---------------------
  const handleGlobalMouseMove = (event: MouseEvent) => {
    options.tooltipStore.updateGlobalMousePosition({
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  };

  const bindPointerTracking = (el: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
  };

  const unbindPointerTracking = (el: HTMLElement | null) => {
    if (!el) return;
    el.removeEventListener('mousemove', handleGlobalMouseMove);
  };

  onMounted(() => {
    bindPointerTracking(options.rootEl.value);
    attachHostObserver();
  });

  onUnmounted(() => {
    unbindPointerTracking(options.rootEl.value);
    detachHostObserver();
  });

  // 根节点变更（较少发生）：重新绑定指针事件，并重新挂载宿主 resize 监听。
  watch(
    options.rootEl,
    (el, prev) => {
      unbindPointerTracking(prev ?? null);
      bindPointerTracking(el ?? null);
      attachHostObserver();
    },
    { immediate: false }
  );

  return {
    rootStyle,
  };
}
