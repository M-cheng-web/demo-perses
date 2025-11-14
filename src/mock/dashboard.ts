/**
 * Dashboard Mock 数据
 */

import type { Dashboard, PanelGroup, DashboardVariable, VariableType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  createCPUUsagePanel,
  createMemoryUsagePanel,
  createMemoryDetailsPanel,
  createNetworkTrafficPanel,
  createDiskUsagePanel,
  createStatPanel,
  createTablePanel,
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
      createStatPanel('CPU 最大使用率', 'max(cpu_usage)', 'percent'),
    ],
    layout: [
      { i: '', x: 0, y: 0, w: 36, h: 10, minW: 12, minH: 6 }, // CPU 使用率图表
      { i: '', x: 36, y: 0, w: 6, h: 5, minW: 4, minH: 4 }, // 平均使用率
      { i: '', x: 42, y: 0, w: 6, h: 5, minW: 4, minH: 4 }, // 最大使用率
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
      createMemoryDetailsPanel(), // 新增：使用 ListLegend 的内存详细监控
    ],
    layout: [
      { i: '', x: 0, y: 0, w: 36, h: 10, minW: 12, minH: 6 },
      { i: '', x: 36, y: 0, w: 12, h: 10, minW: 6, minH: 6 },
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
    panels: [createNetworkTrafficPanel(), createDiskUsagePanel(), createTablePanel()],
    layout: [
      { i: '', x: 0, y: 0, w: 24, h: 10, minW: 12, minH: 6 },
      { i: '', x: 24, y: 0, w: 12, h: 10, minW: 8, minH: 6 },
      { i: '', x: 36, y: 0, w: 12, h: 10, minW: 12, minH: 6 },
    ],
  };

  networkDiskGroup.layout = networkDiskGroup.layout.map((layout, index) => ({
    ...layout,
    i: networkDiskGroup.panels[index]?.id || `panel-${index}`,
  }));

  // 创建示例变量
  const variables: DashboardVariable[] = [
    {
      id: uuidv4(),
      name: 'instance',
      label: '实例',
      type: 'custom' as VariableType,
      options: [
        { text: '服务器 1', value: 'server-1' },
        { text: '服务器 2', value: 'server-2' },
        { text: '服务器 3', value: 'server-3' },
      ],
      current: 'server-1',
      multi: false,
      includeAll: true,
      allValue: '*',
    },
    {
      id: uuidv4(),
      name: 'job',
      label: '任务',
      type: 'custom' as VariableType,
      options: [
        { text: 'Node Exporter', value: 'node-exporter' },
        { text: 'Prometheus', value: 'prometheus' },
        { text: 'Grafana', value: 'grafana' },
      ],
      current: 'node-exporter',
      multi: true,
    },
    {
      id: uuidv4(),
      name: 'interval',
      label: '时间间隔',
      type: 'custom' as VariableType,
      options: [
        { text: '1m', value: '1m' },
        { text: '5m', value: '5m' },
        { text: '10m', value: '10m' },
        { text: '30m', value: '30m' },
      ],
      current: '5m',
    },
  ];

  return {
    id: uuidv4(),
    name: '系统监控 Dashboard',
    description: '完整的系统性能监控面板',
    panelGroups: [cpuGroup, memoryGroup, networkDiskGroup],
    timeRange: {
      from: 'now-1h',
      to: 'now',
    },
    refreshInterval: 0,
    variables,
    createdAt: now,
    updatedAt: now,
    tags: ['系统监控', '性能'],
  };
}

/**
 * 存储的 Dashboard 列表
 */
const dashboards = new Map<string, Dashboard>();

// 初始化默认 Dashboard
const defaultDashboard = createDefaultDashboard();
dashboards.set(defaultDashboard.id, defaultDashboard);

/**
 * 获取所有 Dashboard
 */
export function getAllDashboards(): Dashboard[] {
  return Array.from(dashboards.values());
}

/**
 * 根据 ID 获取 Dashboard
 */
export function getDashboardById(id: string): Dashboard | null {
  return dashboards.get(id) || null;
}

/**
 * 保存 Dashboard
 */
export function saveDashboard(dashboard: Dashboard): void {
  dashboard.updatedAt = Date.now();
  dashboards.set(dashboard.id, dashboard);
}

/**
 * 删除 Dashboard
 */
export function deleteDashboard(id: string): boolean {
  return dashboards.delete(id);
}

/**
 * 获取默认 Dashboard
 */
export function getDefaultDashboard(): Dashboard {
  return defaultDashboard;
}
