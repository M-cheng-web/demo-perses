export type Unsubscribe = () => void;

type Handler<Payload> = (payload: Payload) => void;

/**
 * 一个极简的类型安全事件总线（实例级）
 *
 * 设计说明：
 * - **不是全局单例**：每个 SDK 实例各自维护 listeners，避免多 dashboard 同页渲染时“串台”
 * - `emit` 只应由 SDK 内部调用；宿主侧只使用 `on/off` 订阅与取消订阅
 * - `on()` 会返回 `unsubscribe()`，建议在组件卸载时调用以防泄漏
 */
export function createEmitter<EventMap extends Record<string, any>>() {
  const listeners = new Map<keyof EventMap, Set<Handler<any>>>();

  const on = <K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): Unsubscribe => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler as Handler<any>);
    listeners.set(event, set);
    return () => off(event, handler);
  };

  const off = <K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>) => {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler as Handler<any>);
    if (set.size === 0) listeners.delete(event);
  };

  const emit = <K extends keyof EventMap>(event: K, payload: EventMap[K]) => {
    const set = listeners.get(event);
    if (!set || set.size === 0) return;

    // 复制一份再遍历：避免 emit 过程中 handler 内部调用 off/on 造成迭代失效。
    for (const handler of Array.from(set)) {
      try {
        (handler as Handler<EventMap[K]>)(payload);
      } catch (error) {
        // 单个订阅者报错不应影响其他订阅者（隔离）。
        console.error(`[useDashboardSdk] Event handler error for "${String(event)}":`, error);
      }
    }
  };

  const clear = (event?: keyof EventMap) => {
    if (event === undefined) {
      listeners.clear();
      return;
    }
    listeners.delete(event);
  };

  return { on, off, emit, clear };
}
