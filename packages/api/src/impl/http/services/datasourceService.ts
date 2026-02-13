/**
 * 文件说明：DatasourceService 的 HTTP 实现（占位）
 *
 * 说明：
 * - 该文件负责把“真实后端数据源 API”适配成 contracts 的 DatasourceService
 * - 未来数据源可能不止 Prometheus，这里会是重要扩展点
 */

import type { DatasourceService } from '../../../contracts/datasource';
import type { Datasource, ID } from '@grafana-fast/types';
import type { FetchHttpClient } from '../fetchClient';
import { isHttpError } from '../fetchClient';
import type { HttpApiEndpointKey } from '../endpoints';
import { HttpApiEndpointKey as EndpointKey, getEndpointPath } from '../endpoints';
import { normalizeArrayResponse } from './responseUtils';

export interface HttpDatasourceServiceDeps {
  http: FetchHttpClient;
  endpoints: Record<HttpApiEndpointKey, string>;
}

export function createHttpDatasourceService(_deps: HttpDatasourceServiceDeps): DatasourceService {
  /**
   * 这里实现“最常用”的数据源接口：
   * - 返回值直接当作 @grafana-fast/types 的 Datasource 使用
   * - 后续如果后端返回 DTO 不同，你只需要在这里做一次映射，不影响上层调用
   */
  return {
    async getDefaultDatasource(): Promise<Datasource> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DefaultDatasource);
      return _deps.http.post<Datasource>(path, {});
    },

    async getDatasourceById(id: ID): Promise<Datasource | null> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.GetDatasource);
      try {
        return await _deps.http.post<Datasource>(path, { id });
      } catch (err) {
        // contract 语义：找不到返回 null（而不是抛错）
        if (isHttpError(err) && err.status === 404) return null;
        throw err;
      }
    },

    async listDatasources(): Promise<Datasource[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.ListDatasources);
      const res = await _deps.http.post<unknown>(path, {});
      return normalizeArrayResponse<Datasource>(res);
    },
  };
}
