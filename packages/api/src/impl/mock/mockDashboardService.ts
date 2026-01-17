/**
 * mock DashboardService
 *
 * 说明：
 * - 提供一个默认 Dashboard（包含多面板/变量等），用于演示与回归验证
 * - 这里的返回结构是“规范化后的 Dashboard schemaVersion=1”
 * - 未来接后端时，只需要替换 dashboard.load/save 实现，不应影响 UI 调用
 */
import type { DashboardService } from '../../contracts';
import type { Dashboard, DashboardListItem, ID } from '@grafana-fast/types';

function nowTs() {
  return Date.now();
}

function createDefaultDashboard(): Dashboard {
  const now = nowTs();
  const createLargeGroup = () => {
    const totalPanels = 1000;
    const panels = Array.from({ length: totalPanels }).map((_, idx) => {
      const n = idx + 1;
      const id = `panel-big-${n}`;
      return {
        id,
        name: `Large Panel #${n}`,
        type: 'timeseries',
        queries: [
          {
            id: `q-big-${n}`,
            refId: 'A',
            datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
            expr: 'cpu_usage',
            legendFormat: 'CPU {{cpu}}',
            format: 'time_series',
            instant: false,
            hide: false,
            minStep: 15,
          },
        ],
        options: {
          legend: { show: true, position: 'bottom' },
          format: { unit: 'percent', decimals: 2 },
          specific: { mode: 'line', stackMode: 'none' },
        },
      };
    });

    // Layout: 4 columns per row (12 each), 48 total.
    const w = 12;
    const h = 6;
    const cols = 4;
    const layout = panels.map((p, idx) => {
      const x = (idx % cols) * w;
      const y = Math.floor(idx / cols) * h;
      return { i: p.id, x, y, w, h, minW: 8, minH: 4 };
    });

    return {
      id: 'group-large-1k',
      title: '大规模面板组（1k panels / 虚拟化 & 可视刷新验证）',
      description: '用于验证：只渲染/只刷新 viewport + 上下 0.5 屏；滚动时渐进刷新；避免请求风暴。',
      isCollapsed: true,
      order: 99,
      panels,
      layout,
    };
  };

  return {
    schemaVersion: 1,
    id: 'default',
    name: '系统监控 Dashboard',
    description: 'Mock dashboard (built-in)',
    panelGroups: [
      {
        id: 'group-1',
        title: 'CPU 监控',
        description: 'CPU 相关指标监控',
        isCollapsed: false,
        order: 0,
        panels: [
          {
            id: 'panel-1',
            name: 'CPU 使用率',
            type: 'timeseries',
            queries: [
              {
                id: 'q-1',
                refId: 'A',
                datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
                expr: 'cpu_usage',
                legendFormat: 'CPU {{cpu}}',
                format: 'time_series',
                instant: false,
                hide: false,
                minStep: 15,
              },
            ],
            options: {
              legend: { show: true, position: 'bottom' },
              format: { unit: 'percent', decimals: 2 },
              specific: { mode: 'line', stackMode: 'none' },
            },
          },
          {
            id: 'panel-2',
            name: 'CPU 平均使用率',
            type: 'stat',
            queries: [
              {
                id: 'q-2',
                refId: 'A',
                datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
                expr: 'avg(cpu_usage)',
                format: 'time_series',
                instant: false,
                hide: false,
                minStep: 15,
              },
            ],
            options: {
              format: { unit: 'percent', decimals: 2 },
              specific: { displayMode: 'value-and-name', orientation: 'vertical', textAlign: 'center', showTrend: true },
            },
          },
          {
            id: 'panel-3',
            name: 'CPU 最大使用率',
            type: 'stat',
            queries: [
              {
                id: 'q-3',
                refId: 'A',
                datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
                expr: 'max(cpu_usage)',
                format: 'time_series',
                instant: false,
                hide: false,
                minStep: 15,
              },
            ],
            options: {
              format: { unit: 'percent', decimals: 2 },
              specific: { displayMode: 'value-and-name', orientation: 'vertical', textAlign: 'center', showTrend: true },
            },
          },
          {
            id: 'panel-4',
            name: 'CPU 使用率（副本）',
            type: 'timeseries',
            queries: [
              {
                id: 'q-4',
                refId: 'A',
                datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
                expr: 'cpu_usage',
                legendFormat: 'CPU {{cpu}}',
                format: 'time_series',
                instant: false,
                hide: false,
                minStep: 15,
              },
            ],
            options: {
              legend: { show: true, position: 'bottom' },
              format: { unit: 'percent', decimals: 2 },
              specific: { mode: 'area', stackMode: 'none', fillOpacity: 0.25 },
            },
          },
          {
            id: 'panel-5',
            name: 'CPU 核心对比',
            type: 'bar',
            queries: [
              {
                id: 'q-5',
                refId: 'A',
                datasourceRef: { type: 'prometheus', uid: 'prometheus-mock' },
                expr: 'cpu_usage',
                format: 'time_series',
                instant: false,
                hide: false,
                minStep: 15,
              },
            ],
            options: {
              legend: { show: true, position: 'bottom' },
              format: { unit: 'percent', decimals: 2 },
              specific: { orientation: 'vertical' },
            },
          },
        ],
        layout: [
          { i: 'panel-1', x: 0, y: 0, w: 28, h: 8, minW: 12, minH: 6 },
          { i: 'panel-2', x: 28, y: 0, w: 10, h: 5, minW: 6, minH: 4 },
          { i: 'panel-3', x: 38, y: 0, w: 10, h: 5, minW: 6, minH: 4 },
          { i: 'panel-4', x: 0, y: 8, w: 28, h: 8, minW: 12, minH: 6 },
          { i: 'panel-5', x: 28, y: 8, w: 20, h: 11, minW: 8, minH: 6 },
        ],
      },
      createLargeGroup(),
    ],
    timeRange: { from: 'now-1h', to: 'now' },
    refreshInterval: 0,
    variables: [
      {
        id: 'var-instance',
        name: 'instance',
        label: '实例',
        type: 'query',
        datasource: 'prometheus',
        query: 'up',
        multi: true,
        includeAll: true,
        allValue: '.*',
        options: [],
        current: ['all'],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

let defaultDashboardCache: Dashboard | null = null;

export function createMockDashboardService(): DashboardService {
  return {
    async loadDashboard(id: ID): Promise<Dashboard> {
      if (id === 'default') return (defaultDashboardCache ??= createDefaultDashboard());
      return (defaultDashboardCache ??= createDefaultDashboard());
    },
    async saveDashboard(_dashboard: Dashboard): Promise<void> {
      // no-op for now (kept stable for future persistence)
    },
    async deleteDashboard(_id: ID): Promise<void> {
      // no-op
    },
    async listDashboards(): Promise<DashboardListItem[]> {
      const d = (defaultDashboardCache ??= createDefaultDashboard());
      return [{ id: d.id, name: d.name, description: d.description, createdAt: d.createdAt, updatedAt: d.updatedAt }];
    },
    async getDefaultDashboard(): Promise<Dashboard> {
      return (defaultDashboardCache ??= createDefaultDashboard());
    },
  };
}
