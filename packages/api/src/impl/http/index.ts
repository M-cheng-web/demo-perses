/**
 * 文件说明：HTTP 实现入口（占位）
 *
 * 当前后端未就绪时，这里只保留稳定方法名；后续接入后端文档后，在这里完成 DTO 适配与请求实现。
 */
import type { GrafanaFastApiClient } from '../../contracts';

/**
 * HTTP 实现（占位）
 *
 * 说明：
 * - 当前后端接口尚未确定，因此这里先保留“稳定的方法名”
 * - 等后续有后端文档后，在这里实现 DTO 适配与请求调用
 *
 * 重要原则：
 * - 调用方（dashboard/hook/app）不应该因为后端字段变动而修改代码
 * - 变化应尽可能被封装在 http 实现层内部
 */
export function createHttpApiClient(_config: unknown = {}): GrafanaFastApiClient {
  const notImplemented = (name: string) => async () => {
    throw new Error(`[grafana-fast/api:http] Not implemented: ${name}`);
  };

  return {
    kind: 'http',
    dashboard: {
      loadDashboard: notImplemented('dashboard.loadDashboard'),
      saveDashboard: notImplemented('dashboard.saveDashboard'),
      deleteDashboard: notImplemented('dashboard.deleteDashboard'),
      listDashboards: notImplemented('dashboard.listDashboards'),
      getDefaultDashboard: notImplemented('dashboard.getDefaultDashboard'),
    },
    datasource: {
      getDefaultDatasource: notImplemented('datasource.getDefaultDatasource'),
      getDatasourceById: notImplemented('datasource.getDatasourceById'),
      listDatasources: notImplemented('datasource.listDatasources'),
    },
    query: {
      executeQueries: notImplemented('query.executeQueries'),
      fetchMetrics: notImplemented('query.fetchMetrics'),
      fetchLabelKeys: notImplemented('query.fetchLabelKeys'),
      fetchLabelValues: notImplemented('query.fetchLabelValues'),
    },
    variable: {
      initialize: (_vars) => ({ values: {}, options: {}, lastUpdatedAt: Date.now() }),
      resolveOptions: async () => ({}),
    },
  };
}
