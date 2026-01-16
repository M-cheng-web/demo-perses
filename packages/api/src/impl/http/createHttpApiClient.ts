/**
 * 文件说明：HTTP 实现层 API Client（createHttpApiClient）
 *
 * 现状：
 * - 当前后端接口尚未最终确定，因此这里的 service 方法先保留“稳定方法名”，默认抛 Not implemented
 *
 * 未来接入真实后端时的工作位置：
 * - 按 service（dashboard/datasource/query/variable）分别实现请求与 DTO 适配
 * - 上层（dashboard/hook/app）依旧只依赖 contracts，不需要改动
 *
 * 关键点：
 * - createFetchHttpClient 解决 transport 层问题（baseUrl/headers/超时/取消/错误归一化）
 * - 各 service 文件解决业务 DTO 映射问题（把后端 DTO 转成 @grafana-fast/types 结构）
 */

import type { GrafanaFastApiClient } from '../../contracts';
import { createFetchHttpClient } from './fetchClient';
import type { CreateHttpApiClientOptions } from './config';
import { resolveHttpApiClientConfig } from './config';
import { createHttpDashboardService } from './services/dashboardService';
import { createHttpDatasourceService } from './services/datasourceService';
import { createHttpQueryService } from './services/queryService';
import { createHttpVariableService } from './services/variableService';

/**
 * 创建 HTTP API Client
 *
 * 推荐调用方式（宿主应用/hook）：
 * - createHttpApiClient({ apiConfig: { baseUrl: '/api', auth: { getBearerToken: ... } } })
 */
export function createHttpApiClient(options: CreateHttpApiClientOptions = {}): GrafanaFastApiClient {
  const resolved = resolveHttpApiClientConfig(options.apiConfig);
  const http = createFetchHttpClient(resolved.http);

  // 说明：queryService 未来会负责远端查询执行，也可被 variableService 用于 query-based variable 的 options 拉取
  const queryService = createHttpQueryService({ http, endpoints: resolved.endpoints });

  return {
    kind: 'http',
    dashboard: createHttpDashboardService({ http, endpoints: resolved.endpoints }),
    datasource: createHttpDatasourceService({ http, endpoints: resolved.endpoints }),
    query: queryService,
    variable: createHttpVariableService({ queryService }),
  };
}

