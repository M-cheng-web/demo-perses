/**
 * LocalStorage 存储工具（dashboard 内部）
 *
 * 说明：
 * - 底层实现收敛到 @grafana-fast/utils（createPrefixedStorage）
 * - 该文件保留原导出（StorageManager/StorageKeys）以避免影响现有调用
 */

import { createPrefixedStorage } from '@grafana-fast/utils';

const STORAGE_PREFIX = 'perses_demo_';

const storage = createPrefixedStorage(STORAGE_PREFIX);

export class StorageManager {
  /**
   * 存储数据
   */
  static setItem<T>(key: string, value: T): void {
    storage.setItem<T>(key, value);
  }

  /**
   * 获取数据
   */
  static getItem<T>(key: string): T | null {
    return storage.getItem<T>(key);
  }

  /**
   * 删除数据
   */
  static removeItem(key: string): void {
    storage.removeItem(key);
  }

  /**
   * 清空所有数据（仅清空带前缀的）
   */
  static clear(): void {
    storage.clear();
  }

  /**
   * 检查键是否存在
   */
  static hasItem(key: string): boolean {
    return storage.hasItem(key);
  }

  /**
   * 获取所有键
   */
  static getAllKeys(): string[] {
    return storage.getAllKeys();
  }
}

/**
 * 数据库键常量（dashboard 语义）
 */
export const StorageKeys = {
  DASHBOARDS: 'dashboards',
  DATASOURCES: 'datasources',
  PANELS: 'panels',
  QUERIES: 'queries',
  TIME_RANGE: 'time_range',
  VARIABLES: 'variables',
} as const;
