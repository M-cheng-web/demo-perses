/**
 * 文件说明：DashboardService 契约
 *
 * 这是 UI/核心包访问 Dashboard 数据的唯一入口契约。实现层可对接本地 mock 或后端 HTTP，
 * 调用方不关心具体接口路径/DTO 细节。
 */
import type { DashboardContent, DashboardListItem, DashboardSessionKey, ID, Panel, PanelGroup, PanelLayout } from '@grafana-fast/types';

/**
 * 布局更新（分页）
 *
 * 约定：
 * - 前端分页固定 20 条/页（当前版本产品要求）
 * - 触发拖拽/缩放时，后端更新应携带“当前页全部面板”的位置与大小信息
 * - 这里只传最小字段：i/x/y/w/h（后端若需要更多字段，可自行扩展）
 */
export interface PanelLayoutPatchItem {
  /** 面板 id（等价于 PanelLayout.i） */
  i: ID;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Dashboard 会话上下文（由宿主/后端签发）
 *
 * 说明：
 * - 真实 dashboardId（资源标识）不对前端暴露
 * - 前端仅持有 `dashboardSessionKey`，并在所有请求中携带
 * - HTTP 实现层建议将其映射为 header：`X-Dashboard-Session-Key`
 */
export interface DashboardSessionContext {
  dashboardSessionKey: DashboardSessionKey;
}

export interface PatchPanelGroupLayoutPageRequest extends DashboardSessionContext {
  groupId: ID;
  /**
   * 当前页 layout items（最多 20 条）
   * - 必须包含当前页所有面板（而不是仅变动的那一条）
   */
  items: PanelLayoutPatchItem[];
}

export interface PatchPanelGroupLayoutPageResponse {
  /**
   * 可选：后端可返回“最终落盘后的 layout”（例如后端做了 compact/冲突处理）
   * - 若不返回，前端将沿用本地 optimistic layout
   */
  items?: PanelLayout[];
}

export interface CreatePanelRequest extends DashboardSessionContext {
  groupId: ID;
  /**
   * 可选：由后端决定默认值时可以不传。
   * - 若传入，建议仅传 name/type/queries/options 等核心字段（id 由后端生成）。
   */
  panel?: Partial<Omit<Panel, 'id'>>;
}

export interface CreatePanelResponse {
  panel: Panel;
  /**
   * 可选：新面板初始 layout（若后端不返回，前端可在本地按“放到末尾”生成）
   */
  layout?: PanelLayout;
}

export interface UpdatePanelRequest extends DashboardSessionContext {
  groupId: ID;
  panelId: ID;
  /** 面板完整内容（推荐：由后端做白名单字段落盘） */
  panel: Omit<Panel, 'id'>;
}

export interface UpdatePanelResponse {
  panel: Panel;
}

export interface DeletePanelRequest extends DashboardSessionContext {
  groupId: ID;
  panelId: ID;
}

export interface DuplicatePanelRequest extends DashboardSessionContext {
  groupId: ID;
  panelId: ID;
}

export interface DuplicatePanelResponse {
  panel: Panel;
  layout?: PanelLayout;
}

export interface UpdatePanelGroupRequest extends DashboardSessionContext {
  groupId: ID;
  group: Pick<PanelGroup, 'title' | 'description'>;
}

export interface UpdatePanelGroupResponse {
  group: PanelGroup;
}

export interface CreatePanelGroupRequest extends DashboardSessionContext {
  group: Pick<PanelGroup, 'title' | 'description'>;
}

export interface CreatePanelGroupResponse {
  group: PanelGroup;
}

export interface DeletePanelGroupRequest extends DashboardSessionContext {
  groupId: ID;
}

export interface ReorderPanelGroupsRequest extends DashboardSessionContext {
  order: ID[];
}

export interface ResolveDashboardSessionRequest {
  /**
   * 业务自定义参数（保持自由度）
   *
   * 说明：
   * - 后端基于该 params 定位到“真实 dashboard 资源”（内部 dashboardId）
   * - 必要时可在此处完成初始化（get-or-create），确保后续 load 一定可用
   */
  params: Record<string, any>;
}

export interface ResolveDashboardSessionResponse {
  dashboardSessionKey: DashboardSessionKey;
}

/**
 * DashboardService（契约层）
 *
 * 设计意图：
 * - 这是 UI/核心包唯一依赖的“Dashboard 数据读写入口”
 * - 真实后端的 URL、请求方法、DTO 结构等都应被实现层吸收
 * - contracts 的方法名/语义尽量稳定：除非新增/删除能力，否则不轻易变动
 */
export interface DashboardService {
  /**
   * 解析并签发 dashboardSessionKey（业务入口）
   *
   * 说明：
   * - 真实 dashboardId 不对前端暴露
   * - SDK/宿主应先 resolve 得到 sessionKey，再以 sessionKey 调用 load/save/patch 等接口
   */
  resolveDashboardSession: (req: ResolveDashboardSessionRequest) => Promise<ResolveDashboardSessionResponse>;

  /**
   * 加载单个 Dashboard 内容（只拉一次 JSON）
   *
   * @param dashboardSessionKey 会话级访问 key（由 resolve 接口签发）
   */
  loadDashboard: (dashboardSessionKey: DashboardSessionKey) => Promise<DashboardContent>;

  /**
   * 保存 Dashboard 内容（全量）
   *
   * 说明：
   * - 这是“兜底接口”：用于导入/应用 JSON、或需要整盘覆盖的场景
   * - 常规交互（增删改面板、拖拽布局）应优先走局部接口，避免频繁传大 JSON
   */
  saveDashboard: (dashboardSessionKey: DashboardSessionKey, content: DashboardContent) => Promise<void>;

  /**
   * 删除 Dashboard
   */
  deleteDashboard: (dashboardSessionKey: DashboardSessionKey) => Promise<void>;

  /**
   * 列出 Dashboard（用于列表页）
   * - 返回轻量摘要，避免一次性拉取完整 JSON
   */
  listDashboards: () => Promise<DashboardListItem[]>;

  /**
   * 获取默认 Dashboard
   * - 典型用于“首次进入”或“空状态初始化”
   */
  getDefaultDashboard: () => Promise<DashboardContent>;

  // ---------------------------
  // PanelGroup / Panel 局部更新（产品化编辑流）
  // ---------------------------

  /**
   * 分页布局更新（只提交当前页）
   *
   * 设计意图：
   * - 避免拖拽/缩放时把整个 dashboard JSON 发送给后端
   * - 仍确保“当前页布局一致性”：提交时带上当前页全部面板的位置与大小
   */
  patchPanelGroupLayoutPage?: (req: PatchPanelGroupLayoutPageRequest) => Promise<PatchPanelGroupLayoutPageResponse>;

  /**
   * 创建面板（后端生成 id 并返回）
   */
  createPanel?: (req: CreatePanelRequest) => Promise<CreatePanelResponse>;

  /**
   * 更新面板（保存）
   * - 编辑器点击“保存”时触发
   */
  updatePanel?: (req: UpdatePanelRequest) => Promise<UpdatePanelResponse>;

  /**
   * 删除面板
   */
  deletePanel?: (req: DeletePanelRequest) => Promise<void>;

  /**
   * 复制面板（后端生成新 id 并返回）
   */
  duplicatePanel?: (req: DuplicatePanelRequest) => Promise<DuplicatePanelResponse>;

  /**
   * （预留）面板组元信息更新（标题/描述等）
   * - 当前 UI 仍可走 saveDashboard 或未来补齐
   */
  updatePanelGroup?: (req: UpdatePanelGroupRequest) => Promise<UpdatePanelGroupResponse>;

  /**
   * （预留）创建面板组
   */
  createPanelGroup?: (req: CreatePanelGroupRequest) => Promise<CreatePanelGroupResponse>;

  /**
   * （预留）删除面板组
   */
  deletePanelGroup?: (req: DeletePanelGroupRequest) => Promise<void>;

  /**
   * （预留）面板组排序更新
   */
  reorderPanelGroups?: (req: ReorderPanelGroupsRequest) => Promise<void>;
}
