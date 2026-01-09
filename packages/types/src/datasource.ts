/**
 * 数据源相关类型定义
 */

import type { ID } from './common';

/**
 * 数据源定义
 */
export interface Datasource {
  /** 数据源 ID */
  id: ID;
  /** 数据源名称 */
  name: string;
  /** 数据源类型 */
  type: DatasourceType;
  /** 数据源 URL */
  url: string;
  /** 是否为默认数据源 */
  isDefault: boolean;
  /** 描述 */
  description?: string;
  /** 额外配置 */
  config?: DatasourceConfig;
}

/**
 * 数据源类型
 */
export type DatasourceType = 'prometheus' | 'influxdb' | 'elasticsearch';

/**
 * 数据源配置
 */
export interface DatasourceConfig {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** HTTP 方法 */
  method?: 'GET' | 'POST';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 认证配置 */
  auth?: DatasourceAuth;
}

/**
 * 数据源认证
 */
export interface DatasourceAuth {
  /** 认证类型 */
  type: 'basic' | 'bearer' | 'none';
  /** 用户名（basic auth） */
  username?: string;
  /** 密码（basic auth） */
  password?: string;
  /** Token（bearer auth） */
  token?: string;
}
