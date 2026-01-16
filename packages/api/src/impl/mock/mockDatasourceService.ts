/**
 * mock DatasourceService
 *
 * 说明：
 * - 提供一个默认 Prometheus 数据源（用于 demo 与 QueryRunner 的 datasourceRef 对齐）
 * - 后续接入真实数据源列表时，替换实现层即可
 */
import type { DatasourceService } from '../../contracts';
import type { Datasource } from '@grafana-fast/types';

const defaultDatasource: Datasource = {
  id: 'prometheus-mock',
  name: 'Prometheus',
  type: 'prometheus',
  url: 'http://localhost:9090',
  isDefault: true,
  description: 'Mock Prometheus datasource',
  config: {
    timeout: 30000,
    method: 'POST',
  },
};

export function createMockDatasourceService(): DatasourceService {
  return {
    async getDefaultDatasource(): Promise<Datasource> {
      return defaultDatasource;
    },
    async getDatasourceById(id: string): Promise<Datasource | null> {
      return id === defaultDatasource.id ? defaultDatasource : null;
    },
    async listDatasources(): Promise<Datasource[]> {
      return [defaultDatasource];
    },
  };
}
