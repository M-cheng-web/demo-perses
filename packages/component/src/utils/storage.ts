/**
 * LocalStorage 存储工具
 * 提供类型安全的 localStorage 操作
 */

const STORAGE_PREFIX = 'perses_demo_';

export class StorageManager {
  /**
   * 获取完整的 storage key
   */
  private static getKey(key: string): string {
    return `${STORAGE_PREFIX}${key}`;
  }

  /**
   * 存储数据
   */
  static setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.getKey(key), serialized);
    } catch (error) {
      console.error(`Error saving to localStorage (key: ${key}):`, error);
    }
  }

  /**
   * 获取数据
   */
  static getItem<T>(key: string): T | null {
    try {
      const serialized = localStorage.getItem(this.getKey(key));
      if (serialized === null) {
        return null;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`Error reading from localStorage (key: ${key}):`, error);
      return null;
    }
  }

  /**
   * 删除数据
   */
  static removeItem(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error(`Error removing from localStorage (key: ${key}):`, error);
    }
  }

  /**
   * 清空所有数据（仅清空带前缀的）
   */
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  /**
   * 检查键是否存在
   */
  static hasItem(key: string): boolean {
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  /**
   * 获取所有键
   */
  static getAllKeys(): string[] {
    const keys = Object.keys(localStorage);
    return keys.filter((key) => key.startsWith(STORAGE_PREFIX)).map((key) => key.replace(STORAGE_PREFIX, ''));
  }
}

/**
 * 数据库键常量
 */
export const StorageKeys = {
  DASHBOARDS: 'dashboards',
  DATASOURCES: 'datasources',
  PANELS: 'panels',
  QUERIES: 'queries',
  TIME_RANGE: 'time_range',
  VARIABLES: 'variables',
} as const;
