import { computed, inject, onMounted, onUnmounted, provide, ref, watch, type ComputedRef, type Ref } from 'vue';
import { getActivePinia, type Pinia } from '@grafana-fast/store';
import type { GrafanaFastApiClient } from '@grafana-fast/api';

import { GF_RUNTIME_KEY } from '/#/runtime/keys';
import { setPiniaApiClient } from '/#/runtime/piniaAttachments';
import { subscribeWindowResize } from '/#/runtime/windowEvents';

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
  // Provide “runtime deps” (isolated per dashboard instance).
  provide(GF_RUNTIME_KEY, { id: options.instanceId.value, rootEl: options.rootEl, scrollEl: options.scrollEl });

  // NOTE: inject() must be called during setup (not inside onMounted).
  const injectedPinia = inject<Pinia | undefined>('pinia', undefined);

  // Attach apiClient to pinia so stores (non-component modules) can access per-instance runtime deps.
  // Important: do this during setup/watch (not onMounted) so QueryScheduler can safely access it in setup.
  const activePinia = injectedPinia ?? getActivePinia();
  watch(
    () => options.apiClient,
    (client) => {
      if (!activePinia || !client) return;
      setPiniaApiClient(activePinia, client);
    },
    { immediate: true }
  );

  // ---------------------------
  // Host container height sync
  // ---------------------------
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

  // ---------------------------
  // Pointer tracking (global tooltip)
  // ---------------------------
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

  // Root node change (rare): re-bind pointer tracking and re-attach host resize observer.
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
