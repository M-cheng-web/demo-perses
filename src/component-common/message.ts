export type MessageType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface MessageArgs {
  content: string;
  duration?: number;
  key?: string;
  type?: MessageType;
}

interface MessageItem {
  el: HTMLDivElement;
  timer?: number;
}

const messageMap = new Map<string, MessageItem>();
let container: HTMLDivElement | null = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'cc-message-container';
    document.body.appendChild(container);
  }
}

function removeMessage(key: string) {
  const item = messageMap.get(key);
  if (item) {
    if (item.timer) {
      window.clearTimeout(item.timer);
    }
    item.el.remove();
    messageMap.delete(key);
  }
}

function normalizeArgs(args: string | MessageArgs, type: MessageType) {
  if (typeof args === 'string') {
    return { content: args, type } as MessageArgs;
  }
  return { ...args, type: args.type ?? type };
}

function createMessage(args: string | MessageArgs, type: MessageType) {
  const options = normalizeArgs(args, type);
  ensureContainer();

  const key = options.key || `cc-message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const duration = options.duration ?? (type === 'loading' ? 0 : 2);

  let item = messageMap.get(key);

  if (!item) {
    const el = document.createElement('div');
    el.className = `cc-message cc-message--${options.type}`;
    container!.appendChild(el);
    item = { el };
    messageMap.set(key, item);
  } else {
    item.el.className = `cc-message cc-message--${options.type}`;
  }

  item.el.textContent = '';

  if (options.type === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'cc-message__spinner';
    item.el.appendChild(spinner);
  }

  const content = document.createElement('span');
  content.textContent = options.content;
  item.el.appendChild(content);

  if (item.timer) {
    window.clearTimeout(item.timer);
  }

  if (duration > 0) {
    item.timer = window.setTimeout(() => removeMessage(key), duration * 1000);
  }

  return {
    key,
    close: () => removeMessage(key),
  };
}

export const message = {
  info: (args: string | MessageArgs) => createMessage(args, 'info'),
  success: (args: string | MessageArgs) => createMessage(args, 'success'),
  warning: (args: string | MessageArgs) => createMessage(args, 'warning'),
  error: (args: string | MessageArgs) => createMessage(args, 'error'),
  loading: (args: string | MessageArgs) => createMessage(args, 'loading'),
  destroy: (key?: string) => {
    if (key) {
      removeMessage(key);
    } else {
      Array.from(messageMap.keys()).forEach(removeMessage);
    }
  },
};
