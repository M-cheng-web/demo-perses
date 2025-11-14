/**
 * 本地存储工具
 */

import type { Dashboard } from '@/types';

const STORAGE_PREFIX = 'demo-perses:';

/**
 * 保存到 localStorage
 */
export function setItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * 从 localStorage 读取
 */
export function getItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

/**
 * 从 localStorage 删除
 */
export function removeItem(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * 清空 localStorage
 */
export function clear(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

/**
 * 保存 Dashboard 到本地
 */
export function saveDashboardToLocal(dashboard: Dashboard): void {
  setItem(`dashboard:${dashboard.id}`, dashboard);
}

/**
 * 从本地加载 Dashboard
 */
export function loadDashboardFromLocal(id: string): Dashboard | null {
  return getItem<Dashboard>(`dashboard:${id}`);
}

/**
 * 导出 Dashboard 为 JSON
 */
export function exportDashboardJson(dashboard: Dashboard): string {
  return JSON.stringify(dashboard, null, 2);
}

/**
 * 从 JSON 导入 Dashboard
 */
export function importDashboardJson(json: string): Dashboard {
  return JSON.parse(json);
}

/**
 * 下载 JSON 文件
 */
export function downloadJson(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
