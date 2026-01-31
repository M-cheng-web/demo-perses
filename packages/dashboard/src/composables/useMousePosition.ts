/**
 * 追踪鼠标位置的 Composable
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { subscribeWindowEvent, type Unsubscribe } from '/#/runtime/windowEvents';

export interface MousePosition {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  target: EventTarget | null;
}

export function useMousePosition(): Ref<MousePosition | null> {
  const position = ref<MousePosition | null>(null);
  let unsubscribe: Unsubscribe | null = null;

  const handleMouseMove = (event: MouseEvent) => {
    position.value = {
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      target: event.target,
    };
  };

  onMounted(() => {
    unsubscribe?.();
    unsubscribe = subscribeWindowEvent('mousemove', handleMouseMove, { passive: true });
  });

  onUnmounted(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  return position;
}
