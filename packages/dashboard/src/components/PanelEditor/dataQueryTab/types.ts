import type { PromVisualQuery } from '@grafana-fast/types';
import type { PromqlParseConfidence, PromqlParseWarning } from '@grafana-fast/utils';

export type QueryMode = 'builder' | 'code';

export type BuilderStatus = 'ok' | 'unsupported';

export interface QueryDraft {
  id: string;
  refId: string;
  hide: boolean;
  collapsed: boolean;
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
    parseWarnings?: PromqlParseWarning[];
    confidence?: PromqlParseConfidence;
    /**
     * 当 confidence !== 'exact' 时，Builder 默认只允许预览；
     * 需要用户点击“接受转换”后，才允许编辑并覆盖 code.expr（避免隐式语义变化）。
     */
    acceptedPartial?: boolean;
    /**
     * 语法诊断（带范围），仅编辑器使用；没有依赖强类型，避免类型耦合。
     */
    diagnostics?: any[];
    visualQuery: PromVisualQuery;
  };
}
