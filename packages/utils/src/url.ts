/**
 * URL / endpoint 工具函数
 *
 * 设计目标：
 * - 统一“baseUrl + path”的拼接规则，避免各处手写 startsWith('http') 导致行为不一致
 * - 与 http client 解耦：可被 hooks/sdk/其他包复用
 * - 只提供仓库当前需要的能力：absolute 判断、join、querystring
 */

/**
 * query 参数支持的值类型（足够覆盖常见业务）
 *
 * 约定：
 * - 数组会被展开成重复 key（例如 a=1&a=2）
 * - undefined / null 会被忽略
 */
export type UrlQueryValue = string | number | boolean | null | undefined | Array<string | number | boolean | null | undefined>;

/**
 * 判断一个 URL 是否为“绝对 URL”
 *
 * 判定规则：
 * - 支持 `http://` / `https://`
 * - 也支持 protocol-relative：`//example.com/path`
 *
 * 注意：
 * - `/api`、`api` 这类路径返回 false
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * 规范化 baseUrl：去掉末尾多余的 `/`
 *
 * 入参示例：
 * - "https://example.com/" -> "https://example.com"
 * - "/api/" -> "/api"
 */
export function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) return baseUrl;
  if (baseUrl === '/') return '/';
  return baseUrl.replace(/\/+$/, '');
}

/**
 * 拼接 baseUrl 与 url/path
 *
 * 行为：
 * - url 为绝对 URL 时：直接返回 url
 * - 自动处理 `/`，避免出现 `//` 或漏 `/`
 */
export function joinUrl(baseUrl: string | undefined, url: string): string {
  if (!baseUrl) return url;
  if (isAbsoluteUrl(url)) return url;

  const a = normalizeBaseUrl(baseUrl);
  const b = url.startsWith('/') ? url : `/${url}`;

  if (a === '/') return b;
  return `${a}${b}`;
}

/**
 * 将 query 对象转换为 querystring（不带 `?`）
 *
 * @example
 * toQueryString({ a: 1, b: ['x', 'y'] }) // "a=1&b=x&b=y"
 */
export function toQueryString(query: Record<string, UrlQueryValue>): string {
  const pairs: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null) continue;
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return pairs.join('&');
}

/**
 * 给 URL 追加 query 参数（自动处理 `?` / `&`）
 */
export function withQuery(url: string, query?: Record<string, UrlQueryValue>): string {
  if (!query) return url;
  const qs = toQueryString(query);
  if (!qs) return url;
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

/**
 * 将 baseUrl 与 endpoint/path 归一化成最终 URL
 *
 * 典型场景：
 * - hooks/sdk 把 baseUrl + endpoints 合并成“完整可访问 URL”
 *
 * 规则：
 * - endpoint 为绝对 URL：直接返回 endpoint
 * - endpoint 为相对路径：与 baseUrl join
 */
export function resolveEndpointUrl(baseUrl: string, endpoint: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!endpoint) return normalizedBaseUrl;
  return joinUrl(normalizedBaseUrl, endpoint);
}
