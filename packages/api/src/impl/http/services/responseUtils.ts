/**
 * 文件说明：HTTP 响应的轻量归一化工具（避免过度设计）
 *
 * 背景：
 * - 为了让前后端契约更“可验证”，这里尽量不做容错适配：
 *   - 契约要求返回数组，就必须返回数组 `[...]`
 *   - 返回 `{ items: [...] }`/`{ data: [...] }` 等包装结构属于契约不一致，应尽早抛错暴露
 *
 * 注意：
 * - 这里不做复杂的 schema 校验（那会变成另一套系统）
 * - 如果返回结构完全不匹配，直接抛错，方便你快速定位后端/适配问题
 */

/**
 * 将后端返回值严格归一化为数组（不做包装结构容错）
 */
export function normalizeArrayResponse<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  throw new Error('[grafana-fast/api:http] Invalid array response shape (expected JSON array)');
}
