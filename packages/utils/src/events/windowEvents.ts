/**
 * Global event hub（集中管理 window/element 事件订阅）
 *
 * 目标：
 * - 避免每个组件都直接 addEventListener 造成重复监听与泄漏风险
 * - 同一 (target + type + capture) 只绑定一次原生事件
 * - 内部维护订阅者集合，事件触发时依次触发所有订阅回调
 *
 * 说明：
 * - 这是“基础设施层”，不要写业务逻辑（只做注册/销毁/分发）
 * - SSR/非浏览器环境下会自动 no-op（返回的 unsubscribe 仍可调用）
 */

export type Unsubscribe = () => void;

type Subscriber<E extends Event = Event> = (event: E) => void;

type ListenerOptions = boolean | AddEventListenerOptions | undefined;

interface Channel {
  target: EventTarget;
  type: string;
  options: ListenerOptions;
  subscribers: Set<Subscriber>;
  listener: (event: Event) => void;
}

const channelsByTarget = new WeakMap<EventTarget, Map<string, Channel>>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function captureFromOptions(options: ListenerOptions): boolean {
  if (typeof options === 'boolean') return options;
  return !!options?.capture;
}

function normalizeOptions(type: string, options: ListenerOptions): ListenerOptions {
  // Default options: keep behavior aligned and safe.
  // - scroll/resize: prefer passive listeners to reduce main-thread blocking.
  const capture = captureFromOptions(options);
  const base: AddEventListenerOptions = typeof options === 'object' && options ? { ...options } : {};
  if (type === 'scroll' || type === 'resize') {
    if (base.passive === undefined) base.passive = true;
  }
  base.capture = capture;
  return base;
}

function channelKey(type: string, options: ListenerOptions): string {
  const capture = captureFromOptions(options);
  return `${type}::capture=${capture ? 1 : 0}`;
}

function getOrCreateChannel(target: EventTarget, type: string, options: ListenerOptions): Channel {
  const key = channelKey(type, options);
  let map = channelsByTarget.get(target);
  if (!map) {
    map = new Map();
    channelsByTarget.set(target, map);
  }

  const existing = map.get(key);
  if (existing) return existing;

  const subscribers = new Set<Subscriber>();
  const listener = (event: Event) => {
    // Fan-out: 按订阅顺序依次触发
    subscribers.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        // 避免某个订阅者 throw 导致其他订阅者丢失
        console.error(`[windowEvents] subscriber error for ${type}`, err);
      }
    });
  };

  const normalized = normalizeOptions(type, options);
  target.addEventListener(type, listener as EventListener, normalized as any);

  const channel: Channel = { target, type, options: normalized, subscribers, listener };
  map.set(key, channel);
  return channel;
}

function disposeChannel(target: EventTarget, type: string, options: ListenerOptions) {
  const key = channelKey(type, options);
  const map = channelsByTarget.get(target);
  if (!map) return;
  const channel = map.get(key);
  if (!channel) return;
  if (channel.subscribers.size > 0) return;

  target.removeEventListener(type, channel.listener as EventListener, channel.options as any);
  map.delete(key);
}

export function subscribeEvent<E extends Event = Event>(
  target: EventTarget | null | undefined,
  type: string,
  fn: Subscriber<E>,
  options: ListenerOptions = undefined
): Unsubscribe {
  if (!isBrowser()) return () => void 0;
  if (!target) return () => void 0;

  const channel = getOrCreateChannel(target, type, options);
  channel.subscribers.add(fn as Subscriber);

  return () => {
    channel.subscribers.delete(fn as Subscriber);
    disposeChannel(target, type, channel.options);
  };
}

export function subscribeWindowEvent<E extends Event = Event>(type: string, fn: Subscriber<E>, options: ListenerOptions = undefined): Unsubscribe {
  if (!isBrowser()) return () => void 0;
  return subscribeEvent(window, type, fn as Subscriber, options);
}

// Backward-compatible helpers
export function subscribeWindowResize(fn: () => void): Unsubscribe {
  return subscribeWindowEvent('resize', () => fn(), { passive: true });
}
