/**
 * 文件说明：HTTP 实现层 endpoints（接口路径）定义
 *
 * 为什么要单独做这一层：
 * - 目前后端接口还没定稿，但我们希望调用层（dashboard/hook/app）保持稳定
 * - 当后端路径发生变化时，尽量只改 http 实现层，不要牵扯 contracts / UI
 *
 * 这里解决的问题：
 * - endpoint key 做成强类型（避免手写字符串出错）
 * - 提供默认 endpoint 路径（占位），后续对接真实后端时按文档替换即可
 * - 提供 path 参数替换工具（例如 /dashboards/:id）
 *
 * 重要说明：
 * - DEFAULT_HTTP_API_ENDPOINTS 里的路径是“占位默认值”，不是最终真实接口
 * - 等你给出后端接口文档后，我们会在这里集中完成路径映射与 DTO 适配入口
 */

/**
 * Endpoint Key（强类型）
 *
 * 说明：
 * - 这些 key 是“调用方可依赖的稳定名称”
 * - 它们与实际后端路径无关（路径可变，key 尽量稳定）
 */
export const HttpApiEndpointKey = {
  // --- Dashboard ---
  /** GET /dashboards/:id - 获取单个 Dashboard */
  LoadDashboard: 'LoadDashboard',
  /** POST /dashboards - 保存 Dashboard */
  SaveDashboard: 'SaveDashboard',
  /** DELETE /dashboards/:id - 删除 Dashboard */
  DeleteDashboard: 'DeleteDashboard',
  /** GET /dashboards - 查询全部 Dashboard 列表 */
  AllDashboards: 'AllDashboards',
  /** GET /dashboards/default - 获取默认 Dashboard */
  DefaultDashboard: 'DefaultDashboard',

  // --- Query ---
  /**
   * POST /query/execute - 执行单条查询（占位）
   *
   * 说明：
   * - 当前 contracts 主要使用 executeQueries（批量）作为统一入口
   * - 这里保留 ExecuteQuery 是为了兼容/对齐 hook 层历史命名，后续可按需要决定是否真正实现
   */
  ExecuteQuery: 'ExecuteQuery',
  /** POST /queries/execute - 执行多条查询（推荐：面板通常包含多条 query） */
  ExecuteQueries: 'ExecuteQueries',
  /** GET /query/metrics - 拉取 metric 列表（QueryBuilder 用） */
  FetchMetrics: 'FetchMetrics',
  /** GET /query/label-keys - 拉取 label key 列表（QueryBuilder 用） */
  FetchLabelKeys: 'FetchLabelKeys',
  /** GET /query/label-values - 拉取 label value 列表（QueryBuilder 用） */
  FetchLabelValues: 'FetchLabelValues',

  // --- Datasource ---
  /** GET /datasources/default - 获取默认数据源 */
  DefaultDatasource: 'DefaultDatasource',
  /** GET /datasources/:id - 获取指定数据源 */
  GetDatasource: 'GetDatasource',
  /** GET /datasources - 列出全部数据源（占位） */
  ListDatasources: 'ListDatasources',

  // --- Variable ---
  /**
   * POST /variables/values - query 型变量解析 values/options（占位）
   *
   * 说明：
   * - 当前 VariableService.resolveOptions 默认可以走 QueryService.fetchVariableValues（更通用）
   * - 如果未来后端提供“变量专用接口”，可以在这里单独对接
   */
  FetchVariableValues: 'FetchVariableValues',
} as const;

export type HttpApiEndpointKey = (typeof HttpApiEndpointKey)[keyof typeof HttpApiEndpointKey];

/**
 * 默认 endpoints（占位）
 *
 * 说明：
 * - 这些路径是为了让“配置结构”先稳定下来
 * - 等真实后端接口文档确定后，你只需要在这里调整路径
 * - 如果真实后端路径与这些不同，不影响调用层/契约层
 */
export const DEFAULT_HTTP_API_ENDPOINTS: Record<HttpApiEndpointKey, string> = {
  // --- Dashboard ---
  [HttpApiEndpointKey.LoadDashboard]: '/dashboards/:id',
  [HttpApiEndpointKey.SaveDashboard]: '/dashboards',
  [HttpApiEndpointKey.DeleteDashboard]: '/dashboards/:id',
  [HttpApiEndpointKey.AllDashboards]: '/dashboards',
  [HttpApiEndpointKey.DefaultDashboard]: '/dashboards/default',

  // --- Query ---
  [HttpApiEndpointKey.ExecuteQuery]: '/query/execute',
  [HttpApiEndpointKey.ExecuteQueries]: '/queries/execute',
  [HttpApiEndpointKey.FetchMetrics]: '/query/metrics',
  [HttpApiEndpointKey.FetchLabelKeys]: '/query/label-keys',
  [HttpApiEndpointKey.FetchLabelValues]: '/query/label-values',

  // --- Datasource ---
  [HttpApiEndpointKey.DefaultDatasource]: '/datasources/default',
  [HttpApiEndpointKey.GetDatasource]: '/datasources/:id',
  [HttpApiEndpointKey.ListDatasources]: '/datasources',

  // --- Variable ---
  [HttpApiEndpointKey.FetchVariableValues]: '/variables/values',
};

/**
 * 合并默认 endpoints 与外部覆盖项
 *
 * 典型用途：
 * - 你在 hook/app 里用 apiConfig.endpoints 覆盖某几个路径
 * - 未覆盖的部分仍使用默认值，避免“只改一个 endpoint 导致其他 key undefined”
 */
export function resolveHttpApiEndpoints(
  overrides: Partial<Record<HttpApiEndpointKey, string>> | undefined
): Record<HttpApiEndpointKey, string> {
  return {
    ...DEFAULT_HTTP_API_ENDPOINTS,
    ...(overrides ?? {}),
  };
}

/**
 * 将 path 中的 `:param` 替换为具体值
 *
 * 示例：
 * - fillPathParams('/dashboards/:id', { id: 'default' }) => '/dashboards/default'
 *
 * 说明：
 * - 这里只做最基础的替换；如果 params 缺失，则保留原样（方便你调试）
 */
export function fillPathParams(path: string, params: Record<string, string | number> | undefined): string {
  if (!params) return path;
  return path.replace(/:([A-Za-z0-9_]+)/g, (full, key: string) => {
    const value = params[key];
    if (value == null) return full;
    return encodeURIComponent(String(value));
  });
}

/**
 * 根据 key 获取 endpoint path，并填充 path params
 *
 * 说明：
 * - http/fetchClient 会自动处理 baseUrl 拼接，因此这里返回的通常是“相对路径”
 * - params 仅用于替换 `:id` 这类片段，不负责 querystring（query 由 FetchHttpClient 处理）
 *
 * 示例：
 * - const path = getEndpointPath(endpoints, HttpApiEndpointKey.LoadDashboard, { id: 'default' })
 * - await http.get(path)
 */
export function getEndpointPath(
  endpoints: Record<HttpApiEndpointKey, string>,
  key: HttpApiEndpointKey,
  params?: Record<string, string | number>
): string {
  return fillPathParams(endpoints[key], params);
}
