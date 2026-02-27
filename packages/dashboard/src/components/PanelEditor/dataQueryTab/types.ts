/**
 * DataQueryTab 查询草稿类型：Builder/Code 模式、解析状态与诊断信息。
 */
import type { PromVisualQuery } from '@grafana-fast/types';
import type { PromqlParseConfidence, PromqlParseWarning } from '@grafana-fast/utils';

export type QueryMode = 'builder' | 'code';

export type BuilderStatus = 'ok' | 'unsupported';

export interface QueryDraft {
  id: string;
  refId: string;
  hide: boolean;
  collapsed: boolean;
  mode: QueryMode;
  showExplain: boolean;
  code: {
    expr: string;
    legendFormat: string;
    minStep: number;
  };
  builder: {
    status: BuilderStatus;
    /**
     * 用于区分“语法错误”还是“语义映射不支持”
     * - syntax: PromQL 本身不合法
     * - unsupported: PromQL 合法，但暂时无法映射成 Builder（或仅能 partial）
     */
    issueType?: 'syntax' | 'unsupported';
    message?: string;
    /**
     * 反解析 PromQL 的 warnings（best-effort）
     * - confidence !== 'exact' 时通常会携带 warnings
     * - 仅用于提示用户，不应影响保存/执行逻辑
     */
    parseWarnings?: PromqlParseWarning[];
    confidence?: PromqlParseConfidence;
    /**
     * 语法诊断（带范围），仅编辑器使用；没有依赖强类型，避免类型耦合。
     */
    diagnostics?: any[];
    visualQuery: PromVisualQuery;
  };
}
