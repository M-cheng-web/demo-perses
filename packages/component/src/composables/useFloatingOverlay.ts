import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import { subscribeWindowEvent, subscribeWindowResize, type Unsubscribe } from '@grafana-fast/utils';

type BoolLike = Ref<boolean> | ComputedRef<boolean>;
type ElementLike = Ref<HTMLElement | null | undefined> | ComputedRef<HTMLElement | null | undefined>;

interface UseFloatingOverlayOptions {
  openRef: BoolLike;
  triggerRef: ElementLike;
  overlayRef: ElementLike;
  close: () => void;
  updatePosition: () => void | Promise<void>;
  enableScrollSync?: boolean;
  ignoreOverlayOnOutside?: boolean;
}

export function useFloatingOverlay(options: UseFloatingOverlayOptions) {
  const { openRef, triggerRef, overlayRef, close, updatePosition, enableScrollSync = true, ignoreOverlayOnOutside = false } = options;

  let rafId: number | null = null;
  let unsubscribeOutside: Unsubscribe | null = null;
  let unsubscribeResize: Unsubscribe | null = null;
  let unsubscribeScroll: Unsubscribe | null = null;

  const cleanupScroll = () => {
    unsubscribeScroll?.();
    unsubscribeScroll = null;
  };

  const scheduleUpdatePosition = () => {
    if (!openRef.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      void updatePosition();
    });
  };

  const handleOutside = (evt: MouseEvent) => {
    const trigger = triggerRef.value;
    if (!trigger) return;

    const target = evt.target as Node | null;
    if (target && trigger.contains(target)) return;

    if (!ignoreOverlayOnOutside) {
      const overlay = overlayRef.value;
      if (target && overlay?.contains(target)) return;
    }

    close();
  };

  onMounted(() => {
    unsubscribeOutside = subscribeWindowEvent('click', handleOutside);
    unsubscribeResize = subscribeWindowResize(() => scheduleUpdatePosition());
  });

  watch(
    () => openRef.value,
    (open) => {
      cleanupScroll();
      if (!open) return;
      scheduleUpdatePosition();
      if (!enableScrollSync) return;
      unsubscribeScroll = subscribeWindowEvent('scroll', () => scheduleUpdatePosition(), { capture: true, passive: true });
    }
  );

  onBeforeUnmount(() => {
    unsubscribeOutside?.();
    unsubscribeOutside = null;
    unsubscribeResize?.();
    unsubscribeResize = null;
    cleanupScroll();
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  return {
    scheduleUpdatePosition,
  };
}
