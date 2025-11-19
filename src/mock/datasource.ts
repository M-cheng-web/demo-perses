/**
 * 数据源 Mock 数据 - 直接返回假数据
 */

import type { Datasource, DatasourceType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 创建默认数据源
 */
function createDefaultDatasource(): Datasource {
  return {
    id: uuidv4(),
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
}

// 缓存默认数据源实例（仅用于返回，不持久化）
let defaultDatasourceCache: Datasource | null = null;

/**
 * 获取默认数据源
 */
export function getDefaultDatasource(): Datasource {
  // 如果缓存存在，直接返回
  if (defaultDatasourceCache) {
    return defaultDatasourceCache;
  }

  // 创建并缓存默认数据源
  defaultDatasourceCache = createDefaultDatasource();
  return defaultDatasourceCache;
}

/**
 * 根据 ID 获取数据源
 */
export function getDatasourceById(id: string): Datasource | undefined {
  const defaultDs = getDefaultDatasource();
  // 如果 ID 匹配，返回默认数据源
  if (defaultDs.id === id) {
    return defaultDs;
  }
  return undefined;
}

/**
 * 根据名称获取数据源
 */
export function getDatasourceByName(name: string): Datasource | undefined {
  const allDatasources = getAllDatasources();
  return allDatasources.find((ds) => ds.name === name);
}

/**
 * 获取所有数据源
 */
export function getAllDatasources(): Datasource[] {
  // 直接返回默认数据源
  return [getDefaultDatasource()];
}

/**
 * 保存数据源（仅用于兼容性，不实际保存）
 */
export function saveDatasource(datasource: Datasource): void {
  // 不进行任何操作，仅用于兼容性
  console.log('saveDatasource called (no-op in mock mode):', datasource.id);
}

/**
 * 创建新的数据源
 */
export function createDatasource(datasource: Omit<Datasource, 'id'>): Datasource {
  const newDatasource: Datasource = {
    ...datasource,
    id: uuidv4(),
  };

  // 不进行任何保存操作
  return newDatasource;
}

/**
 * 删除数据源（仅用于兼容性，不实际删除）
 */
export function deleteDatasource(id: string): boolean {
  // 不进行任何操作，仅用于兼容性
  console.log('deleteDatasource called (no-op in mock mode):', id);
  return false;
}

/**
 * 导出默认数据源常量（向后兼容）
 */
export const DEFAULT_DATASOURCE = getDefaultDatasource();
export const DATASOURCES = getAllDatasources();
