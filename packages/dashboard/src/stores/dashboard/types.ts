import type { DashboardContent, DashboardSessionKey, ID } from '@grafana-fast/types';

export type BootStage = 'idle' | 'fetching' | 'parsing' | 'initializing' | 'ready' | 'error';
export type DashboardViewMode = 'grouped' | 'allPanels';

export interface DashboardState {
  /**
   * 当前 dashboardSessionKey（会话级访问 Key）
   *
   * 说明：
   * - DashboardContent（内容 JSON）不包含任何资源标识
   * - 真实 dashboardId 仅后端内部存在，不对前端暴露
   * - 该字段由宿主/SDK 在 loadDashboard 时传入并绑定，用于后续所有读写请求
   */
  dashboardSessionKey: DashboardSessionKey | null;
  /** 当前 Dashboard */
  currentDashboard: DashboardContent | null;
  /**
   * 全局只读模式（宿主能力开关）
   *
   * 语义：
   * - true：禁止任何会修改 Dashboard JSON 的操作（UI 会禁用入口，store 层也会兜底 guard）
   * - false：允许编辑（仍受 boot/viewMode/editingGroupId 等约束）
   */
  isReadOnly: boolean;
  /**
   * 最近一次“已被远端确认成功保存”的 Dashboard（用于乐观更新失败回滚）
   *
   * 语义：
   * - currentDashboard：页面当前正在渲染/编辑的“乐观态”
   * - syncedDashboard：最后一次与远端一致的“已确认态”
   */
  syncedDashboard: DashboardContent | null;
  /**
   * 当前处于“可编辑”状态的面板组（仅允许一个）
   *
   * 设计说明：
   * - 本项目已移除“全局编辑模式”的概念（避免虚拟滚动 + 拖拽缩放交互过于复杂）
   * - 只有当前打开的面板组允许编辑其子面板（拖拽/缩放/复制/删除等）
   */
  editingGroupId: ID | null;
  /** 视图模式：分组视图 / 全部面板视图（只读） */
  viewMode: DashboardViewMode;
  /** 是否正在保存 */
  isSaving: boolean;
  /**
   * 是否正在同步（保留字段）
   *
   * 说明：
   * - 早期版本用于“全量 JSON auto-save”（saveDashboard）
   * - 产品化版本推荐走“局部接口”（layout patch / panel CRUD / group CRUD）
   * - 这里仍保留用于：
   *   1) JSON 导入后手动保存
   *   2) 作为兜底的全量持久化
   */
  isSyncing: boolean;
  /** 最近一次 load/save 的错误（用于 UI 展示与宿主接管） */
  lastError: string | null;
  /** 全屏查看的面板 */
  viewPanelId: { groupId: ID; panelId: ID } | null;
  /** 是否处于“加载/初始化”中（加载时应锁住交互） */
  isBooting: boolean;
  /** boot 阶段（用于 UI 展示更明确的状态） */
  bootStage: BootStage;
  /** boot 过程统计（用于提示“数据量大，需要等待”） */
  bootStats: {
    startedAt: number | null;
    groupCount: number | null;
    panelCount: number | null;
    jsonBytes: number | null;
    source: 'remote' | 'import' | null;
  };

  /** 是否存在“尚未同步到远端”的变更（仅用于 UI/调试提示） */
  hasUnsyncedChanges: boolean;
  /**
   * Dashboard 内容变更代际（单调递增）
   *
   * 说明：
   * - 用于 SDK/外部集成场景：无需 deep watch 大对象即可感知“dashboard JSON 有变化”
   * - 任何会改变 currentDashboard 内容的操作都应 bump
   */
  dashboardContentRevision: number;

  // ---- Internal sync state (per store instance) ----
  _syncTimerId: number | null;
  _syncQueued: boolean;
  _syncSeq: number;
  _syncInFlightSeq: number | null;

  // ---- UI coordination (cross-component) ----
  /**
   * UI 请求跳转某个面板组的分页（例如创建面板后自动跳到最后一页展示）
   * - 由 store 发出请求
   * - 由持有 pagination state 的组件（Dashboard.vue）消费并清空
   */
  uiPageJumpRequest: { groupId: ID; page: number; nonce: number } | null;
  _uiPageJumpNonce: number;

  // ---- Internal partial-persist state (per store instance) ----
  /** 局部布局 patch：按 groupId 记录 in-flight，避免并发乱序 */
  _layoutPatchInFlightByGroupId: Record<string, boolean>;
  /** 局部布局 patch：若 in-flight，缓存最后一次提交的当前页 items（最多 20 条） */
  _layoutPatchQueuedItemsByGroupId: Record<string, Array<{ i: ID; x: number; y: number; w: number; h: number }> | null>;
  /** 用于使 “dashboard 发生替换” 时，让旧请求的回写失效 */
  _remoteOpSeq: number;
}
