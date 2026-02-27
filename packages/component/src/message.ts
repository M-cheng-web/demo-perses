/**
 * 全局 message：轻量 DOM 实现的消息提示（支持 PortalRoot 与多实例嵌入场景）。
 */
import { createTimeout, type TimeoutHandle } from '@grafana-fast/utils';

type MessageType = 'info' | 'success' | 'error' | 'warning' | 'loading';

export interface MessageOptions {
  content: string;
  type?: MessageType;
  duration?: number;
  key?: string;
  /**
   * 可选：挂载容器覆盖。
   * - 适用于多实例嵌入场景。
   * - 未传入时，会尝试挂载到“当前活跃”的 portal root。
   */
  container?: string | HTMLElement;
}

type MessageInput = MessageOptions | string;

const resolveMountEl = () => {
  // 优先使用“活跃 portal root”（由 ConfigProvider 设置），使 message 出现在当前交互的实例中。
  const active = (globalThis as any).__gfActivePortalRoot as HTMLElement | undefined;
  if (active && typeof active === 'object' && active instanceof HTMLElement && active.isConnected) {
    return active;
  }

  // 兜底：使用最后一个 portal root，以便在嵌入场景中继承主题 tokens。
  const roots = Array.from(document.querySelectorAll<HTMLElement>('.gf-portal-root'));
  return roots[roots.length - 1] ?? document.body;
};

const ensureContainer = (override?: string | HTMLElement) => {
  const mountEl = override
    ? typeof override === 'string'
      ? (document.querySelector<HTMLElement>(override) ?? resolveMountEl())
      : override
    : resolveMountEl();
  let el = document.querySelector<HTMLElement>('.gf-message-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'gf-message-container';
    mountEl.appendChild(el);
    return el;
  }
  if (el.parentElement !== mountEl) mountEl.appendChild(el);
  return el;
};

const instances = new Map<string, HTMLElement>();
const timers = new WeakMap<HTMLElement, TimeoutHandle>();

const resolveOptions = (input: MessageInput, type?: MessageType, duration?: number): MessageOptions => {
  if (typeof input === 'string') {
    return { content: input, type, duration };
  }
  return { ...input, type: input.type ?? type, duration: input.duration ?? duration };
};

const removeItem = (item: HTMLElement, key?: string) => {
  const timerId = timers.get(item);
  if (timerId) {
    timerId.cancel();
    timers.delete(item);
  }

  item.classList.add('is-leave');
  item.classList.remove('is-visible');
  createTimeout(() => item.remove(), 220);
  if (key) instances.delete(key);
};

const resolveSymbol = (type: MessageType) => {
  const map: Record<MessageType, string> = {
    info: 'i',
    success: '✓',
    warning: '!',
    error: '×',
    loading: '…',
  };
  return map[type] ?? 'i';
};

const createItem = (content: string, type: MessageType) => {
  const item = document.createElement('div');
  item.className = `gf-message gf-message--${type}`;

  const icon = document.createElement('span');
  icon.className = 'gf-message__icon';
  icon.setAttribute('data-symbol', resolveSymbol(type));

  const text = document.createElement('span');
  text.className = 'gf-message__content';
  text.textContent = content;

  item.appendChild(icon);
  item.appendChild(text);
  return item;
};

const updateItem = (item: HTMLElement, content: string, type: MessageType) => {
  item.className = `gf-message gf-message--${type} is-visible`;
  const icon = item.querySelector<HTMLElement>('.gf-message__icon');
  if (icon) icon.setAttribute('data-symbol', resolveSymbol(type));
  const text = item.querySelector<HTMLElement>('.gf-message__content');
  if (text) text.textContent = content;
};

const show = (input: MessageInput, preset?: MessageType, presetDuration?: number) => {
  const opts = resolveOptions(input, preset, presetDuration);
  const { content, type = 'info', duration = 2200, key, container: mountOverride } = opts;
  const container = ensureContainer(mountOverride);

  if (key && instances.has(key)) {
    const existing = instances.get(key)!;
    updateItem(existing, content, type);
    const timerId = timers.get(existing);
    timerId?.cancel();
    if (duration !== 0)
      timers.set(
        existing,
        createTimeout(() => removeItem(existing, key), duration)
      );
    return;
  }

  const item = createItem(content, type);
  item.classList.add('is-enter');
  container.appendChild(item);

  if (key) {
    instances.set(key, item);
  }

  requestAnimationFrame(() => {
    item.classList.add('is-visible');
    item.classList.remove('is-enter');
  });

  if (duration !== 0) {
    timers.set(
      item,
      createTimeout(() => removeItem(item, key), duration)
    );
  }
};

export const message = {
  open: (opts: MessageOptions) => show(opts),
  success: (content: MessageInput, duration?: number) => show(content, 'success', duration),
  error: (content: MessageInput, duration?: number) => show(content, 'error', duration),
  warning: (content: MessageInput, duration?: number) => show(content, 'warning', duration),
  info: (content: MessageInput, duration?: number) => show(content, 'info', duration),
  loading: (content: MessageInput, duration: number | undefined = 0) => show(content, 'loading', duration),
};

export default message;
