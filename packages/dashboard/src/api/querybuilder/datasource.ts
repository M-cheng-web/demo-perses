/**
 * 创建一个 mock 的 Prometheus 数据源
 * 用于 QueryBuilder 组件
 */

import type { PrometheusDatasource } from '@grafana-fast/types';

/**
 * 默认的 mock Prometheus 数据源
 */
export const createMockPrometheusDataSource = (): PrometheusDatasource => {
  return {
    id: 'prometheus-mock',
    name: 'Prometheus',
    type: 'prometheus',
    url: 'http://localhost:9090',
    access: 'proxy',
    isDefault: true,
    jsonData: {
      timeInterval: '15s',
      queryTimeout: '60s',
      httpMethod: 'POST',
    },
  };
};

/**
 * 获取默认数据源
 */
export const getDefaultDataSource = (): PrometheusDatasource => {
  return createMockPrometheusDataSource();
};

