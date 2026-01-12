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

const resolveOptions = (input: MessageInput, type?: MessageType, duration?: number): MessageOptions => {
  if (typeof input === 'string') {
    return { content: input, type, duration };
  }
  return { ...input, type: input.type ?? type, duration: input.duration ?? duration };
};

const removeItem = (item: HTMLElement, key?: string) => {
  item.style.opacity = '0';
  item.style.transform = 'translateY(-6px)';
  setTimeout(() => item.remove(), 200);
  if (key) instances.delete(key);
};

const show = (input: MessageInput, preset?: MessageType, presetDuration?: number) => {
  const opts = resolveOptions(input, preset, presetDuration);
  const { content, type = 'info', duration = 2200, key } = opts;
  const container = ensureContainer();

  if (key && instances.has(key)) {
    const existing = instances.get(key)!;
    existing.textContent = content;
    existing.className = `gf-message gf-message--${type}`;
    if (duration !== 0) {
      setTimeout(() => removeItem(existing, key), duration);
    }
    return;
  }

  const item = document.createElement('div');
  item.className = `gf-message gf-message--${type}`;
  item.textContent = content;
  container.appendChild(item);

  if (key) {
    instances.set(key, item);
  }

  if (duration !== 0) {
    const timer = window.setTimeout(() => {
      removeItem(item, key);
      clearTimeout(timer);
    }, duration);
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
