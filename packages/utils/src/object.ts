/**
 * Object 工具函数
 */

/**
 * 判断是否为“纯对象”（Plain Object）
 *
 * 用途：
 * - deepMerge 等函数需要区分普通对象 vs Array/Date/Map 等
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  if (value == null) return false;
  if (typeof value !== 'object') return false;
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * 深合并：把 override 合并到 base
 *
 * 合并规则（当前仓库实际需求）：
 * - plain object：递归合并
 * - array / primitive：直接替换
 * - override 里的 `undefined` 不覆盖 base（避免把默认值“抹掉”）
 *
 * @param base 基础对象（通常是 defaults）
 * @param override 覆盖对象（通常是外部传入的 partial）
 */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base)) {
    return (override === undefined ? base : (override as any)) as T;
  }

  const out: Record<string, any> = { ...(base as any) };
  if (!isPlainObject(override)) return out as T;

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }

  return out as T;
}

