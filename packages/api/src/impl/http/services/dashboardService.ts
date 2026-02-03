/**
 * 文件说明：DashboardService 的 HTTP 实现（占位）
 *
 * 说明：
 * - 该文件负责把“真实后端 HTTP API”适配成 contracts 的 DashboardService
 * - 后端字段/路径变化应尽量封装在这里，不影响上层调用
 */

import type { DashboardService } from '../../../contracts/dashboard';
import type { DashboardContent, DashboardListItem, DashboardId } from '@grafana-fast/types';
import type { FetchHttpClient } from '../fetchClient';
import type { HttpApiEndpointKey } from '../endpoints';
import { HttpApiEndpointKey as EndpointKey, getEndpointPath } from '../endpoints';
import { normalizeArrayResponse } from './responseUtils';

export interface HttpDashboardServiceDeps {
  http: FetchHttpClient;
  endpoints: Record<HttpApiEndpointKey, string>;
}

export function createHttpDashboardService(_deps: HttpDashboardServiceDeps): DashboardService {
  /**
   * 这里实现“最常用、最直观”的 HTTP 行为：
   * - 直接把后端 JSON 当作 Dashboard 类型使用（后续你可以在这里做 DTO → types 的映射）
   * - 保存/删除等操作默认不关心返回体（很多后端会返回 { ok: true } 或空）
   *
   * 拿到后端文档后，建议按以下模式微调（不要影响上层）：
   *
   * 1) 从 deps 拿到 http + endpoints
   * 2) 用 getEndpointPath(endpoints, key, params) 得到路径
   * 3) 调用 http.get/post/... 发请求
   * 4) 在这里完成 DTO → @grafana-fast/types 的转换（核心包不关心 DTO）
   */
  return {
    async loadDashboard(dashboardId: DashboardId): Promise<DashboardContent> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.LoadDashboard, { id: dashboardId });
      return _deps.http.get<DashboardContent>(path);
    },

    async saveDashboard(dashboardId: DashboardId, content: DashboardContent): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.SaveDashboard, { id: dashboardId });
      await _deps.http.put(path, content);
    },

    async deleteDashboard(dashboardId: DashboardId): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DeleteDashboard, { id: dashboardId });
      await _deps.http.delete(path);
    },

    async listDashboards(): Promise<DashboardListItem[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.AllDashboards);
      const res = await _deps.http.get<unknown>(path);
      return normalizeArrayResponse<DashboardListItem>(res);
    },

    async getDefaultDashboard(): Promise<DashboardContent> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DefaultDashboard);
      return _deps.http.get<DashboardContent>(path);
    },
  };
}
