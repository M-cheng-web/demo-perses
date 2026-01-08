/**
 * Mock 数据管理器
 */

export * from './timeSeriesData';
export * from './datasource';
export * from './queries';
export * from './panels';
export * from './dashboard';

import { executeQuery, executeQueries } from './queries';
import { getDashboardById, saveDashboard, deleteDashboard, getAllDashboards, getDefaultDashboard } from './dashboard';
import { getDefaultDatasource, getDatasourceById } from './datasource';

/**
 * Mock 数据管理器类
 */
export class MockDataManager {
  /**
   * 执行查询
   */
  async executeQuery(...args: Parameters<typeof executeQuery>) {
    return executeQuery(...args);
  }

  /**
   * 执行多个查询
   */
  async executeQueries(...args: Parameters<typeof executeQueries>) {
    return executeQueries(...args);
  }

  /**
   * 获取 Dashboard
   */
  getDashboard(id: string) {
    return getDashboardById(id);
  }

  /**
   * 保存 Dashboard
   */
  saveDashboard(...args: Parameters<typeof saveDashboard>) {
    return saveDashboard(...args);
  }

  /**
   * 删除 Dashboard
   */
  deleteDashboard(id: string) {
    return deleteDashboard(id);
  }

  /**
   * 获取所有 Dashboard
   */
  getAllDashboards() {
    return getAllDashboards();
  }

  /**
   * 获取默认 Dashboard
   */
  getDefaultDashboard() {
    return getDefaultDashboard();
  }

  /**
   * 获取数据源
   */
  getDatasource(id: string) {
    return getDatasourceById(id);
  }

  /**
   * 获取默认数据源
   */
  getDefaultDatasource() {
    return getDefaultDatasource();
  }
}

/**
 * 全局 Mock 数据管理器实例
 */
export const mockDataManager = new MockDataManager();
