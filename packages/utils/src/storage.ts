/**
 * Storage 工具（LocalStorage 为主）
 *
 * 设计目标：
 * - 提供“带前缀”的 key 管理，避免不同业务/包间冲突
 * - 提供类型友好的泛型 get/set
 * - SSR/非浏览器环境下安全 no-op（不会抛错）
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export interface StorageSerializer {
  serialize: (value: unknown) => string;
  deserialize: (value: string) => unknown;
}

export interface StorageErrorContext {
  op: 'set' | 'get' | 'remove' | 'clear' | 'keys';
  key?: string;
  error: unknown;
}

export type StorageErrorHandler = (ctx: StorageErrorContext) => void;

export interface CreatePrefixedStorageOptions {
  /**
   * 自定义 storage 实现（默认使用 globalThis.localStorage）
   */
  storage?: StorageLike;
  /**
   * 自定义序列化器（默认 JSON）
   */
  serializer?: StorageSerializer;
  /**
   * 错误回调（默认：有 console 时 console.error；否则 no-op）
   */
  onError?: StorageErrorHandler;
}

export interface PrefixedStorage {
  /**
   * 写入（会自动加前缀并序列化）
   */
  setItem: <T>(key: string, value: T) => void;
  /**
   * 读取（会自动加前缀并反序列化）
   *
   * @returns 未命中或解析失败返回 null
   */
  getItem: <T>(key: string) => T | null;
  /**
   * 删除
   */
  removeItem: (key: string) => void;
  /**
   * 清空所有带前缀的 key
   */
  clear: () => void;
  /**
   * 是否存在（仅检查 key 是否存在，不解析值）
   */
  hasItem: (key: string) => boolean;
  /**
   * 获取所有“去前缀后”的 key 列表
   */
  getAllKeys: () => string[];
}

const DEFAULT_SERIALIZER: StorageSerializer = {
  serialize: (value) => JSON.stringify(value),
  deserialize: (value) => JSON.parse(value) as unknown,
};

function getDefaultOnError(): StorageErrorHandler {
  const c = (globalThis as any).console as Console | undefined;
  if (!c || typeof c.error !== 'function') {
    return () => {};
  }
  return ({ op, key, error }) => {
    c.error(`[storage] ${op} failed${key ? ` (key: ${key})` : ''}:`, error);
  };
}

function getDefaultStorage(): StorageLike | undefined {
  try {
    const s = (globalThis as any).localStorage as StorageLike | undefined;
    return s;
  } catch {
    return undefined;
  }
}

/**
 * 创建一个带前缀的 storage 管理器
 *
 * @param prefix key 前缀（建议以包/应用名区分，例如 "perses_demo_"）
 * @param options 可选配置（storage/serializer/onError）
 */
export function createPrefixedStorage(prefix: string, options: CreatePrefixedStorageOptions = {}): PrefixedStorage {
  const storage = options.storage ?? getDefaultStorage();
  const serializer = options.serializer ?? DEFAULT_SERIALIZER;
  const onError = options.onError ?? getDefaultOnError();

  const getKey = (key: string) => `${prefix}${key}`;

  const safeKeys = (): string[] => {
    if (!storage) return [];
    try {
      // 优先使用 key(i)/length（更通用，且不依赖 Object.keys(localStorage)）
      if (typeof storage.key === 'function' && typeof storage.length === 'number') {
        const out: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(prefix)) out.push(k);
        }
        return out;
      }
      // 兜底：某些实现可能可枚举
      return Object.keys(storage as any).filter((k) => k.startsWith(prefix));
    } catch (error) {
      onError({ op: 'keys', error });
      return [];
    }
  };

  return {
    setItem: (key, value) => {
      if (!storage) return;
      try {
        const serialized = serializer.serialize(value);
        storage.setItem(getKey(key), serialized);
      } catch (error) {
        onError({ op: 'set', key, error });
      }
    },
    getItem: (key) => {
      if (!storage) return null;
      try {
        const serialized = storage.getItem(getKey(key));
        if (serialized === null) return null;
        return serializer.deserialize(serialized) as any;
      } catch (error) {
        onError({ op: 'get', key, error });
        return null;
      }
    },
    removeItem: (key) => {
      if (!storage) return;
      try {
        storage.removeItem(getKey(key));
      } catch (error) {
        onError({ op: 'remove', key, error });
      }
    },
    clear: () => {
      if (!storage) return;
      try {
        const keys = safeKeys();
        keys.forEach((k) => storage.removeItem(k));
      } catch (error) {
        onError({ op: 'clear', error });
      }
    },
    hasItem: (key) => {
      if (!storage) return false;
      try {
        return storage.getItem(getKey(key)) !== null;
      } catch {
        return false;
      }
    },
    getAllKeys: () => safeKeys().map((k) => k.slice(prefix.length)),
  };
}

