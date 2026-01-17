/**
 * 通用工具函数（无业务语义、可跨包复用）
 */

let generateIdCounter = 0;

/**
 * 生成唯一 ID（字符串）
 *
 * 出参说明：
 * - 尽量使用 `crypto.randomUUID()`（若运行时支持）
 * - 否则降级为 “时间 + 随机 + 自增” 的组合
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2);
  generateIdCounter = (generateIdCounter + 1) % 0xffff;
  const seq = generateIdCounter.toString(16).padStart(4, '0');
  return `id-${now}-${seq}-${rand}`;
}

/**
 * 创建带前缀的 ID（始终带 prefix，便于日志/调试快速识别来源）
 *
 * @param prefix 语义前缀（例如 "rt" / "sdk" / "req"）
 * @returns 形如 "rt-xxxxxxxx-xxxx-...." 的字符串
 */
export function createPrefixedId(prefix: string): string {
  const safe = String(prefix || 'id').trim() || 'id';
  const core = generateId();
  return `${safe}-${core}`;
}

/**
 * 深度克隆（JSON 版）
 *
 * 注意：
 * - 仅适用于可 JSON 序列化的数据（对象/数组/基础类型）
 * - 会丢失 `Date` / `Map` / `Set` / `undefined` / 函数 等信息
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 深度克隆（优先 structuredClone）
 *
 * 说明：
 * - 运行时支持 structuredClone 时：更安全地克隆 Date/Map/Set 等结构
 * - 否则降级到 deepClone（JSON clone）
 */
export function deepCloneStructured<T>(value: T): T {
  const sc = (globalThis as any).structuredClone as undefined | ((v: any) => any);
  if (typeof sc === 'function') return sc(value) as T;
  return deepClone(value);
}

export type CancellableFn<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
  flush: () => void;
};

export interface TimeoutHandle {
  /**
   * 取消：阻止回调被触发
   */
  cancel: () => void;
  /**
   * 立即执行（仅执行一次）；并取消原定时器
   */
  flush: () => void;
}

/**
 * 创建一个可取消的 timeout
 *
 * 适用场景：
 * - UI 动画结束后的延迟清理（remove/hidden）
 * - “只执行一次”的延迟动作（与 debounce 不同，它不会因为重复调用而改变延迟）
 *
 * @param fn 到期回调
 * @param delayMs 延迟毫秒数
 */
export function createTimeout(fn: () => void, delayMs: number): TimeoutHandle {
  let done = false;
  let id: ReturnType<typeof setTimeout> | null = null;

  const runOnce = () => {
    if (done) return;
    done = true;
    fn();
  };

  id = setTimeout(() => {
    id = null;
    runOnce();
  }, delayMs);

  return {
    cancel: () => {
      if (id != null) clearTimeout(id);
      id = null;
      done = true;
    },
    flush: () => {
      if (id != null) clearTimeout(id);
      id = null;
      runOnce();
    },
  };
}

/**
 * 防抖
 *
 * @param func 被包装的函数
 * @param wait 触发间隔（毫秒）
 * @returns 新函数（入参同 func；无返回值）
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * 防抖（可取消/可 flush）
 *
 * 使用建议：
 * - 组件卸载时调用 `.cancel()`，避免计时器泄漏
 * - 需要“立即执行末次调用”时使用 `.flush()`
 */
export function debounceCancellable<T extends (...args: any[]) => any>(func: T, wait: number): CancellableFn<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingInvoke: (() => void) | null = null;

  const invoke = () => {
    pendingInvoke?.();
    pendingInvoke = null;
  };

  const wrapped = function (this: any, ...args: Parameters<T>) {
    // Use an arrow to capture `this` without aliasing it (ESLint no-this-alias)
    pendingInvoke = () => func.apply(this, args);
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      invoke();
    }, wait);
  } as CancellableFn<T>;

  wrapped.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    pendingInvoke = null;
  };

  wrapped.flush = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    invoke();
  };

  return wrapped;
}

/**
 * 节流
 *
 * @param func 被包装的函数
 * @param wait 最小执行间隔（毫秒）
 * @returns 新函数（入参同 func；无返回值）
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (this: any, ...args: Parameters<T>) {
    if (inThrottle) return;
    func.apply(this, args);
    inThrottle = true;
    setTimeout(() => {
      inThrottle = false;
    }, wait);
  };
}

/**
 * 节流（可取消/可 flush）
 *
 * 语义：
 * - 同一窗口期内仅执行一次（leading）
 * - 若窗口期内有后续调用，flush 会执行“最后一次调用”
 */
export function throttleCancellable<T extends (...args: any[]) => any>(func: T, wait: number): CancellableFn<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let inThrottle = false;
  let pendingInvoke: (() => void) | null = null;

  const invoke = (ctx: any, args: Parameters<T>) => {
    func.apply(ctx, args);
  };

  const scheduleTrailing = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      inThrottle = false;
      if (pendingInvoke) {
        // 执行 trailing，并重新进入 throttle 窗口
        pendingInvoke();
        pendingInvoke = null;
        inThrottle = true;
        scheduleTrailing();
      }
    }, wait);
  };

  const wrapped = function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      invoke(this, args);
      inThrottle = true;
      scheduleTrailing();
      return;
    }
    // Use an arrow to capture `this` without aliasing it (ESLint no-this-alias)
    pendingInvoke = () => invoke(this, args);
  } as CancellableFn<T>;

  wrapped.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    inThrottle = false;
    pendingInvoke = null;
  };

  wrapped.flush = () => {
    pendingInvoke?.();
    pendingInvoke = null;
  };

  return wrapped;
}

/**
 * 延迟执行（sleep）
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全地访问嵌套属性
 *
 * @param obj 任意对象
 * @param path 形如 "a.b.c" 的路径
 * @param defaultValue 取不到时的默认值
 */
export function get(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null) return defaultValue;
    result = result[key];
  }

  return result ?? defaultValue;
}

/**
 * 检查是否为空
 *
 * 判定规则：
 * - null/undefined -> empty
 * - string -> trim 后为空
 * - array -> length === 0
 * - object -> key 数量 === 0
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 去除对象中的 undefined 值
 *
 * @param obj 输入对象
 * @returns 新对象（不修改原对象）
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  Object.keys(obj).forEach((key) => {
    const k = key as keyof T;
    if (obj[k] !== undefined) {
      result[k] = obj[k];
    }
  });
  return result;
}
