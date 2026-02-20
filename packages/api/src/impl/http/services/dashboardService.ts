/**
 * 文件说明：DashboardService 的 HTTP 实现（占位）
 *
 * 说明：
 * - 该文件负责把“真实后端 HTTP API”适配成 contracts 的 DashboardService
 * - 后端字段/路径变化应尽量封装在这里，不影响上层调用
 */

import type { DashboardService } from '../../../contracts/dashboard';
import type {
  CreatePanelGroupRequest,
  CreatePanelGroupResponse,
  CreatePanelRequest,
  CreatePanelResponse,
  DeletePanelRequest,
  DeletePanelGroupRequest,
  DuplicatePanelRequest,
  DuplicatePanelResponse,
  PatchPanelGroupLayoutPageRequest,
  PatchPanelGroupLayoutPageResponse,
  ReorderPanelGroupsRequest,
  ResolveDashboardSessionRequest,
  ResolveDashboardSessionResponse,
  UpdatePanelGroupRequest,
  UpdatePanelGroupResponse,
  UpdatePanelRequest,
  UpdatePanelResponse,
} from '../../../contracts/dashboard';
import type { DashboardContent, DashboardListItem, DashboardSessionKey } from '@grafana-fast/types';
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
   * 3) 调用 http.post 发请求（本期约定：统一 POST + JSON body）
   * 4) 在这里完成 DTO → @grafana-fast/types 的转换（核心包不关心 DTO）
   */
  return {
    async resolveDashboardSession(req: ResolveDashboardSessionRequest): Promise<ResolveDashboardSessionResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.ResolveDashboardSession);
      return _deps.http.post<ResolveDashboardSessionResponse>(path, { params: req.params });
    },

    async loadDashboard(dashboardSessionKey: DashboardSessionKey): Promise<DashboardContent> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.LoadDashboard);
      return _deps.http.post<DashboardContent>(path, {}, { headers: { 'X-Dashboard-Session-Key': dashboardSessionKey } });
    },

    async saveDashboard(dashboardSessionKey: DashboardSessionKey, content: DashboardContent): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.SaveDashboard);
      await _deps.http.post(path, { content }, { headers: { 'X-Dashboard-Session-Key': dashboardSessionKey } });
    },

    async deleteDashboard(dashboardSessionKey: DashboardSessionKey): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DeleteDashboard);
      await _deps.http.post(path, {}, { headers: { 'X-Dashboard-Session-Key': dashboardSessionKey } });
    },

    async listDashboards(): Promise<DashboardListItem[]> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.AllDashboards);
      const res = await _deps.http.post<unknown>(path, {});
      return normalizeArrayResponse<DashboardListItem>(res);
    },

    async getDefaultDashboard(): Promise<DashboardContent> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DefaultDashboard);
      return _deps.http.post<DashboardContent>(path, {});
    },

    async patchPanelGroupLayoutPage(req: PatchPanelGroupLayoutPageRequest): Promise<PatchPanelGroupLayoutPageResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.PatchPanelGroupLayoutPage);
      return _deps.http.post<PatchPanelGroupLayoutPageResponse>(
        path,
        { groupId: req.groupId, items: req.items },
        { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } }
      );
    },

    async createPanel(req: CreatePanelRequest): Promise<CreatePanelResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.CreatePanel);
      return _deps.http.post<CreatePanelResponse>(path, { groupId: req.groupId, panel: req.panel }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async updatePanel(req: UpdatePanelRequest): Promise<UpdatePanelResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.UpdatePanel);
      return _deps.http.post<UpdatePanelResponse>(path, {
        groupId: req.groupId,
        panelId: req.panelId,
        panel: req.panel,
      }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async deletePanel(req: DeletePanelRequest): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DeletePanel);
      await _deps.http.post(path, { groupId: req.groupId, panelId: req.panelId }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async duplicatePanel(req: DuplicatePanelRequest): Promise<DuplicatePanelResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DuplicatePanel);
      return _deps.http.post<DuplicatePanelResponse>(path, { groupId: req.groupId, panelId: req.panelId }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async updatePanelGroup(req: UpdatePanelGroupRequest): Promise<UpdatePanelGroupResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.UpdatePanelGroup);
      return _deps.http.post<UpdatePanelGroupResponse>(path, { groupId: req.groupId, group: req.group }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async createPanelGroup(req: CreatePanelGroupRequest): Promise<CreatePanelGroupResponse> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.CreatePanelGroup);
      return _deps.http.post<CreatePanelGroupResponse>(path, { group: req.group }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async deletePanelGroup(req: DeletePanelGroupRequest): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.DeletePanelGroup);
      await _deps.http.post(path, { groupId: req.groupId }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },

    async reorderPanelGroups(req: ReorderPanelGroupsRequest): Promise<void> {
      const path = getEndpointPath(_deps.endpoints, EndpointKey.ReorderPanelGroups);
      await _deps.http.post(path, { order: req.order }, { headers: { 'X-Dashboard-Session-Key': req.dashboardSessionKey } });
    },
  };
}
