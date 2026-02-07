import { onMounted, onUnmounted, watch, type Ref } from 'vue';

interface Size {
  width: number;
  height: number;
}

export const getElementSize = (el: HTMLElement | null): Size | null => {
  if (!el) return null;
  return {
    width: el.clientWidth,
    height: el.clientHeight,
  };
};

export const shouldRemountOnTargetSwap = (isMounted: boolean, prevEl: HTMLElement | null, nextEl: HTMLElement | null): boolean => {
  if (!isMounted) return false;
  if (!prevEl) return false;
  if (!nextEl) return false;
  return prevEl !== nextEl;
};

interface UseDashboardMountLifecycleOptions {
  targetRef: Ref<HTMLElement | null>;
  isMountedRef: Ref<boolean>;
  mountDashboard: () => void;
  unmountDashboard: () => void;
  onSizeChange: (size: Size) => void;
  onLifecycleUnmount?: () => void;
}

/**
 * 统一管理 SDK 的容器挂载/重挂载与 ResizeObserver 生命周期。
 */
export function useDashboardMountLifecycle(options: UseDashboardMountLifecycleOptions) {
  const { targetRef, isMountedRef, mountDashboard, unmountDashboard, onSizeChange, onLifecycleUnmount } = options;

  let resizeObserver: ResizeObserver | null = null;

  const updateSize = () => {
    const size = getElementSize(targetRef.value);
    if (!size) return;
    onSizeChange(size);
  };

  watch(
    targetRef,
    (el, prevEl, onCleanup) => {
      if (resizeObserver && prevEl) {
        resizeObserver.unobserve(prevEl);
      }

      if (el) {
        resizeObserver?.observe(el);
        updateSize();

        if (shouldRemountOnTargetSwap(isMountedRef.value, prevEl ?? null, el ?? null)) {
          unmountDashboard();
          mountDashboard();
        }
      }

      onCleanup(() => {
        if (resizeObserver && el) resizeObserver.unobserve(el);
      });
    },
    { immediate: true }
  );

  onMounted(() => {
    resizeObserver = new ResizeObserver(updateSize);
    if (targetRef.value) {
      resizeObserver.observe(targetRef.value);
      updateSize();
    }
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    onLifecycleUnmount?.();
  });

  return {
    updateSize,
  };
}
