/**
 * 文件说明：HTTP 响应的轻量归一化工具（避免过度设计）
 *
 * 背景：
 * - 真实后端在不同团队/框架下，返回结构经常会有两种常见形态：
 *   1) 直接返回数组：`[...]`
 *   2) 包一层对象：`{ items: [...] }` / `{ data: [...] }` / `{ results: [...] }`
 *
 * 目标：
 * - 在不“过度抽象”的前提下，给 http 实现层一点容错能力
 * - 这样你对接后端时更省心：只要最终能归一化成 contracts 期待的类型即可
 *
 * 注意：
 * - 这里不做复杂的 schema 校验（那会变成另一套系统）
 * - 如果返回结构完全不匹配，直接抛错，方便你快速定位后端/适配问题
 */

/**
 * 尝试把后端返回值归一化为数组
 *
 * @param value 任意返回值
 * @param keys  可选：当 value 是对象时，尝试从这些字段中寻找数组
 */
export function normalizeArrayResponse<T>(value: unknown, keys: string[] = ['items', 'data', 'results']): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
    }
  }

  throw new Error('[grafana-fast/api:http] Invalid array response shape');
}
