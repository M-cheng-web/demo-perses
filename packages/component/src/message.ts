type MessageType = 'info' | 'success' | 'error' | 'warning' | 'loading';

export interface MessageOptions {
  content: string;
  type?: MessageType;
  duration?: number;
  key?: string;
}

type MessageInput = MessageOptions | string;

const ensureContainer = () => {
  let el = document.querySelector<HTMLElement>('.gf-message-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'gf-message-container';
    document.body.appendChild(el);
  }
  return el;
};

const instances = new Map<string, HTMLElement>();
const timers = new WeakMap<HTMLElement, number>();

const resolveOptions = (input: MessageInput, type?: MessageType, duration?: number): MessageOptions => {
  if (typeof input === 'string') {
    return { content: input, type, duration };
  }
  return { ...input, type: input.type ?? type, duration: input.duration ?? duration };
};

const removeItem = (item: HTMLElement, key?: string) => {
  const timerId = timers.get(item);
  if (timerId) {
    window.clearTimeout(timerId);
    timers.delete(item);
  }

  item.classList.add('is-leave');
  item.classList.remove('is-visible');
  window.setTimeout(() => item.remove(), 220);
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
  const { content, type = 'info', duration = 2200, key } = opts;
  const container = ensureContainer();

  if (key && instances.has(key)) {
    const existing = instances.get(key)!;
    updateItem(existing, content, type);
    const timerId = timers.get(existing);
    if (timerId) window.clearTimeout(timerId);
    if (duration !== 0) timers.set(existing, window.setTimeout(() => removeItem(existing, key), duration));
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
    timers.set(item, window.setTimeout(() => removeItem(item, key), duration));
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
