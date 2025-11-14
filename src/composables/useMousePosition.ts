/**
 * 追踪鼠标位置的 Composable
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export interface MousePosition {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  target: EventTarget | null;
}

export function useMousePosition(): Ref<MousePosition | null> {
  const position = ref<MousePosition | null>(null);

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
    window.addEventListener('mousemove', handleMouseMove);
  });

  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
  });

  return position;
}

