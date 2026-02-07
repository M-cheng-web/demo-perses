import type { ComputedRef, Ref } from 'vue';
import type { Panel, QueryResult } from '@grafana-fast/types';

export type PanelQueryPhase = 'idle' | 'waiting' | 'queued' | 'loading' | 'ready' | 'error';
export type PanelLoadingKind = 'none' | 'blocking' | 'refreshing';

export interface PanelQueryState {
  /** 当前生命周期阶段（新语义） */
  phase: Ref<PanelQueryPhase>;
  /** 当前 loading 展示类型（请求开始时确定，中途不切换） */
  loadingKind: Ref<PanelLoadingKind>;
  /** 是否存在可展示的查询快照（包含 data / empty / error 的已落地结果） */
  hasSnapshot: Ref<boolean>;
  /** 当前快照是否陈旧（由全局条件变化或面板查询变更触发） */
  stale: Ref<boolean>;
  /** 当前错误信息（空字符串表示无错误） */
  error: Ref<string>;
  /** 当前查询结果（多 query 对齐） */
  results: Ref<QueryResult[]>;
  /** 主动触发刷新 */
  refresh: () => void;
}

export interface ViewportStatePayload {
  renderPanelIds: string[];
  activePanelIds: string[];
}

export type RefreshReason = 'timeRange' | 'variables' | 'panel-change' | 'became-visible' | 'manual';

export interface RefreshTask {
  panelId: string;
  priority: number;
  generation: number;
  reason: RefreshReason;
  enqueuedAt: number;
}

export interface PanelRegistration {
  panelId: string;
  getPanel: () => Panel;
  state: PanelQueryState;
  abort: AbortController | null;
  lastEnqueuedAt: number;
  /** 当前是否有实际请求在执行（in-flight） */
  inflight: boolean;
  /** 用于防止 setTimeout 清理 loading 的竞态（每次请求 +1） */
  loadingToken: number;
  /** 当前有多少个组件实例“挂载”了这个 panel（虚拟化场景下会频繁 mount/unmount） */
  mounts: number;
  /** 停止对当前 panelRef 的 queries watch（每次 mount 更新 ref 时需替换） */
  stopQueryWatch?: () => void;
  /** 最近一次成功落地结果的全局条件代际 */
  lastLoadedConditionGen: number;
  /** 面板局部脏标记（查询变更/手动刷新后，允许“可见时懒更新”） */
  dirty: boolean;
  /** 是否存在可展示快照 */
  hasSnapshot: boolean;
  /** 当前 loading 展示类型（请求开始时确定，中途不切换） */
  loadingKind: PanelLoadingKind;
  /** 最近一次“卸载到 0 mounts”时间（用于延时回收） */
  lastDetachedAt: number;
}

export type PanelRef = Ref<Panel> | ComputedRef<Panel>;

export interface QuerySchedulerDebugTask {
  panelId: string;
  reason: RefreshReason;
  priority: number;
  generation: number;
  enqueuedAt: number;
}

export interface QuerySchedulerDebugSnapshot {
  queueGeneration: number;
  conditionGeneration: number;
  registrationCount: number;
  renderPanelCount: number;
  activePanelCount: number;
  pendingCount: number;
  inflightCount: number;
  renderPanelIds: string[];
  activePanelIds: string[];
  pendingTasks: QuerySchedulerDebugTask[];
}
