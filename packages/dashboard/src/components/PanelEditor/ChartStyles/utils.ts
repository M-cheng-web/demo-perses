/**
 * 文件说明：ChartStyles 工具函数
 *
 * 这里主要提供深合并能力（deepMerge），用于把“默认 options”与“外部传入的 partial options”合并，
 * 避免浅合并导致嵌套字段丢失（例如 timeseries.specific.fillOpacity 变成 undefined）。
 */
function isPlainObject(value: unknown): value is Record<string, any> {
  if (value == null) return false;
  if (typeof value !== 'object') return false;
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Deep-merge `override` into `base`.
 * - Plain objects are merged recursively
 * - Arrays and primitives are replaced
 * - `undefined` in override does not overwrite base
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
