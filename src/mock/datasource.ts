/**
 * 数据源 Mock 数据
 */

import type { Datasource, DatasourceType } from '@/types';

/**
 * 默认 Prometheus 数据源
 */
export const DEFAULT_DATASOURCE: Datasource = {
  id: 'ds-prometheus-default',
  name: 'Prometheus',
  type: 'prometheus' as DatasourceType,
  url: 'http://localhost:9090',
  isDefault: true,
  description: '默认 Prometheus 数据源',
  config: {
    timeout: 30000,
    method: 'POST',
  },
};

/**
 * 所有数据源列表
 */
export const DATASOURCES: Datasource[] = [DEFAULT_DATASOURCE];

/**
 * 根据 ID 获取数据源
 */
export function getDatasourceById(id: string): Datasource | undefined {
  return DATASOURCES.find((ds) => ds.id === id);
}

/**
 * 根据名称获取数据源
 */
export function getDatasourceByName(name: string): Datasource | undefined {
  return DATASOURCES.find((ds) => ds.name === name);
}

/**
 * 获取默认数据源
 */
export function getDefaultDatasource(): Datasource {
  return DEFAULT_DATASOURCE;
}
