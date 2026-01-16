/**
 * Window 事件订阅（集中管理）
 *
 * 背景：
 * - 某些组件（例如图表 resize）需要监听 window.resize
 * - 如果每个组件都直接 addEventListener，会导致大量重复监听与泄漏风险
 *
 * 这里的做法：
 * - 全局只绑定一次 window.resize
 * - 内部维护订阅者集合，按需 subscribe/unsubscribe
 */
type Unsubscribe = () => void;

const resizeSubscribers = new Set<() => void>();
let resizeBound = false;

function ensureResizeListener() {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener(
    'resize',
    () => {
      resizeSubscribers.forEach((fn) => fn());
    },
    { passive: true }
  );
}

export function subscribeWindowResize(fn: () => void): Unsubscribe {
  ensureResizeListener();
  resizeSubscribers.add(fn);
  return () => {
    resizeSubscribers.delete(fn);
  };
}
