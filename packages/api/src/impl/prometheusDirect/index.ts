/**
 * 文件说明：prometheus-direct 实现入口（占位）
 *
 * 目标是让前端无需后端即可直连 Prometheus HTTP API。当前仅预留稳定方法名。
 */
import type { GrafanaFastApiClient } from '../../contracts';

/**
 * prometheus-direct 实现（占位）
 *
 * 目标：
 * - 让前端在无后端的情况下，直接调用 Prometheus HTTP API（/api/v1/query_range 等）
 *
 * 说明：
 * - 当前仅预留稳定方法名；后续实现时保持 contracts 不变
 */
export function createPrometheusDirectApiClient(_config: unknown = {}): GrafanaFastApiClient {
  const notImplemented = (name: string) => async () => {
    throw new Error(`[grafana-fast/api:prometheus-direct] Not implemented: ${name}`);
  };

  return {
    kind: 'prometheus-direct',
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
