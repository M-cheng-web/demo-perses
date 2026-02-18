/**
 * 文件说明：API Client 聚合契约
 *
 * 这是 @grafana-fast/api 的“入口契约”，用于把各类能力（dashboard/datasource/query/variable）聚合到一个 client 上。
 * 调用方只依赖这个稳定接口；实现层（mock/http）可以自由替换/演进。
 */
import type { DashboardService } from './dashboard';
import type { QueryService } from './query';
import type { VariableService } from './variable';

/**
 * @grafana-fast/api - 契约层（Contracts）
 *
 * 目标：
 * - 把“数据访问能力”从 Dashboard/UI 核心逻辑中抽离出来
 * - UI 只依赖稳定的接口契约（GrafanaFastApiClient 及其子服务）
 * - 后端接口入参/出参变动时，通常只需要调整实现层（mock/http），而不需要改 UI/核心包
 *
 * 结构约定：
 * - contracts/：只放接口/类型（稳定面向调用方），不要出现具体实现细节
 * - impl/：实现层（mock 默认可用；http 预留口子）
 */
export type ApiImplementationKind = 'mock' | 'http';

/**
 * 统一 API Client（聚合入口）
 *
 * 说明：
 * - Dashboard 运行时通过依赖注入拿到一个 client（默认 mock）
 * - 每个子 service 对应一类能力：dashboard / datasource / query / variable
 * - client.kind 仅用于调试/选择实现；调用方不应依赖某个实现的私有行为
 */
export interface GrafanaFastApiClient {
  /**
   * 当前实现类型：
   * - mock：本地内置 mock（后端未就绪时默认）
   * - http：HTTP 实现（预留，后续接真实后端）
   */
  kind: ApiImplementationKind;
  dashboard: DashboardService;
  query: QueryService;
  variable: VariableService;
}
