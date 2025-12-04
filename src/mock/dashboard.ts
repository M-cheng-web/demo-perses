/**
 * Dashboard Mock 数据 - 直接返回假数据
 */

import type { Dashboard, PanelGroup, DashboardVariable } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  createCPUUsagePanel,
  createMemoryUsagePanel,
  createMemoryDetailsPanel,
  createNetworkTrafficPanel,
  createDiskUsagePanel,
  createStatPanel,
  createTablePanel,
  // createBarChartPanel,
  createGaugePanel,
} from './panels';

/**
 * 创建默认 Dashboard
 */
export function createDefaultDashboard(): Dashboard {
  const now = Date.now();

  // CPU 监控组
  const cpuGroup: PanelGroup = {
    id: uuidv4(),
    title: 'CPU 监控',
    description: 'CPU 相关指标监控',
    isCollapsed: false,
    order: 0,
    panels: [
      createCPUUsagePanel(),
      createStatPanel('CPU 平均使用率', 'avg(cpu_usage)', 'percent'),
      createCPUUsagePanel(),
      // createStatPanel('CPU 最大使用率', 'max(cpu_usage)', 'percent'),
      // createBarChartPanel('CPU 核心对比', 'cpu_usage', 'percent'),
    ],
    layout: [
      { i: '', x: 0, y: 0, w: 30, h: 8, minW: 12, minH: 6 }, // CPU 使用率图表
      { i: '', x: 30, y: 0, w: 6, h: 5, minW: 4, minH: 4 }, // 平均使用率
      { i: '', x: 0, y: 15, w: 30, h: 8, minW: 12, minH: 6 }, // CPU 使用率图表
      // { i: '', x: 36, y: 0, w: 6, h: 5, minW: 4, minH: 4 }, // 最大使用率
      // { i: '', x: 30, y: 5, w: 12, h: 5, minW: 8, minH: 4 }, // CPU 核心对比柱状图
    ],
  };

  // 关联面板 ID 到布局
  cpuGroup.layout = cpuGroup.layout.map((layout, index) => ({
    ...layout,
    i: cpuGroup.panels[index]?.id || `panel-${index}`,
  }));

  // 内存监控组
  const memoryGroup: PanelGroup = {
    id: uuidv4(),
    title: '内存监控',
    description: '内存相关指标监控',
    isCollapsed: false,
    order: 1,
    panels: [
      createMemoryUsagePanel(),
      createStatPanel('内存使用量', 'memory_usage{type="used"}', 'bytes'),
      createStatPanel('可用内存', 'memory_available', 'bytes'),
      createMemoryDetailsPanel(), // 使用 ListLegend 的内存详细监控
    ],
    layout: [
      { i: '', x: 0, y: 0, w: 30, h: 10, minW: 12, minH: 6 },
      { i: '', x: 30, y: 0, w: 9, h: 5, minW: 6, minH: 4 },
      { i: '', x: 39, y: 0, w: 9, h: 5, minW: 6, minH: 4 },
      { i: '', x: 0, y: 10, w: 48, h: 12, minW: 24, minH: 10 }, // 内存详细监控，占满宽度
    ],
  };

  memoryGroup.layout = memoryGroup.layout.map((layout, index) => ({
    ...layout,
    i: memoryGroup.panels[index]?.id || `panel-${index}`,
  }));

  // 网络和磁盘监控组
  const networkDiskGroup: PanelGroup = {
    id: uuidv4(),
    title: '网络与磁盘监控',
    description: '网络流量和磁盘使用监控',
    isCollapsed: false,
    order: 2,
    panels: [createNetworkTrafficPanel(), createDiskUsagePanel(), createTablePanel(), createStatPanel('网络总流量', 'sum(network_traffic)', 'bytes')],
    layout: [
      { i: '', x: 0, y: 0, w: 24, h: 10, minW: 12, minH: 6 },
      { i: '', x: 24, y: 0, w: 12, h: 10, minW: 8, minH: 6 },
      { i: '', x: 36, y: 0, w: 12, h: 10, minW: 12, minH: 6 },
      { i: '', x: 24, y: 10, w: 12, h: 5, minW: 6, minH: 4 },
    ],
  };

  networkDiskGroup.layout = networkDiskGroup.layout.map((layout, index) => ({
    ...layout,
    i: networkDiskGroup.panels[index]?.id || `panel-${index}`,
  }));

  // 性能指标组
  const performanceGroup: PanelGroup = {
    id: uuidv4(),
    title: '性能指标概览',
    description: '系统整体性能指标',
    isCollapsed: false,
    order: 3,
    panels: [
      createStatPanel('系统负载', 'system_load', 'short'),
      createStatPanel('进程数量', 'process_count', 'short'),
      createStatPanel('线程数量', 'thread_count', 'short'),
      createGaugePanel('系统健康度', 'system_health', 0, 100),
    ],
    layout: [
      { i: '', x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
      { i: '', x: 12, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
      { i: '', x: 24, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
      { i: '', x: 36, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    ],
  };

  performanceGroup.layout = performanceGroup.layout.map((layout, index) => ({
    ...layout,
    i: performanceGroup.panels[index]?.id || `panel-${index}`,
  }));

  // 创建示例变量
  const variables: DashboardVariable[] = [
    {
      id: uuidv4(),
      name: 'instance',
      label: '实例',
      type: 'select',
      options: [
        { text: '所有实例', value: 'all' },
        { text: '服务器 1', value: 'server-1' },
        { text: '服务器 2', value: 'server-2' },
        { text: '服务器 3', value: 'server-3' },
        { text: '服务器 4', value: 'server-4' },
      ],
      current: 'all',
    },
    {
      id: uuidv4(),
      name: 'interval',
      label: '时间间隔',
      type: 'select',
      options: [
        { text: '1 分钟', value: '1m' },
        { text: '5 分钟', value: '5m' },
        { text: '10 分钟', value: '10m' },
        { text: '30 分钟', value: '30m' },
        { text: '1 小时', value: '1h' },
      ],
      current: '5m',
    },
    {
      id: uuidv4(),
      name: 'environment',
      label: '环境',
      type: 'select',
      options: [
        { text: '生产环境', value: 'production' },
        { text: '测试环境', value: 'staging' },
        { text: '开发环境', value: 'development' },
      ],
      current: 'production',
    },
  ];

  return {
    id: uuidv4(),
    name: '系统监控 Dashboard',
    description: '完整的系统性能监控面板，包含 CPU、内存、网络、磁盘等多维度指标',
    panelGroups: [cpuGroup],
    // panelGroups: [cpuGroup, memoryGroup, networkDiskGroup, performanceGroup],
    timeRange: {
      from: 'now-1h',
      to: 'now',
    },
    refreshInterval: 0,
    variables,
    createdAt: now,
    updatedAt: now,
  };
}

// 缓存默认 Dashboard 实例（仅用于返回，不持久化）
let defaultDashboardCache: Dashboard | null = null;

/**
 * 获取所有 Dashboard
 */
export function getAllDashboards(): Dashboard[] {
  // 直接返回默认 Dashboard
  return [getDefaultDashboard()];
}

/**
 * 根据 ID 获取 Dashboard
 */
export function getDashboardById(_id: string): Dashboard {
  const defaultDashboard = getDefaultDashboard();
  return defaultDashboard;
}

/**
 * 保存 Dashboard（仅用于兼容性，不实际保存）
 */
export function saveDashboard(dashboard: Dashboard): void {
  // 不进行任何操作，仅用于兼容性
  console.log('saveDashboard called (no-op in mock mode):', dashboard.id);
}

/**
 * 创建新的 Dashboard
 */
export function createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard {
  const now = Date.now();
  const newDashboard: Dashboard = {
    ...dashboard,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  // 不进行任何保存操作
  return newDashboard;
}

/**
 * 删除 Dashboard（仅用于兼容性，不实际删除）
 */
export function deleteDashboard(id: string): boolean {
  // 不进行任何操作，仅用于兼容性
  console.log('deleteDashboard called (no-op in mock mode):', id);
  return false;
}

/**
 * 获取默认 Dashboard
 */
export function getDefaultDashboard(): Dashboard {
  // 如果缓存存在，直接返回
  if (defaultDashboardCache) {
    return defaultDashboardCache;
  }

  // 创建并缓存默认 Dashboard
  defaultDashboardCache = createDefaultDashboard();
  return defaultDashboardCache;
}

/**
 * 重置所有 Dashboard（恢复到默认状态）
 */
export function resetDashboards(): void {
  // 清除缓存，下次调用时会重新创建
  defaultDashboardCache = null;
}
