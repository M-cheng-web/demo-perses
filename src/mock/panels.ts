/**
 * 面板 Mock 数据
 */

import type { Panel, PanelType, Query } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { deepClone } from '@/utils';
import { getDefaultTimeSeriesOptions } from '@/components/PanelEditor/ChartStyles/timeSeriesDefaultOptions';

/**
 * 创建查询
 */
function createQuery(expr: string, legendFormat?: string): Query {
  return {
    id: uuidv4(),
    datasource: 'Prometheus',
    expr,
    legendFormat,
    minStep: 15,
    format: 'time_series',
    instant: false,
  };
}

/**
 * 创建 CPU 使用率面板
 */
export function createCPUUsagePanel(): any {
  return {
    id: uuidv4(),
    name: 'CPU 使用率',
    description: '显示所有 CPU 核心的使用率',
    type: 'timeseries' as PanelType,
    queries: [createQuery('cpu_usage', 'CPU {{cpu}}')],
    options: {
      ...deepClone(getDefaultTimeSeriesOptions()),
    },
  };
}

/**
 * 创建内存使用率面板
 */
export function createMemoryUsagePanel(): Panel {
  return {
    id: uuidv4(),
    name: '内存使用率',
    description: '显示内存使用情况',
    type: 'timeseries' as PanelType,
    queries: [createQuery('memory_usage', '{{type}}')],
    options: {
      chart: {
        smooth: true,
        showSymbol: false,
        stack: 'total',
      },
      axis: {
        xAxis: { show: true, type: 'time' },
        yAxis: { show: true, min: 0 },
      },
      legend: {
        show: true,
        position: 'bottom',
      },
      format: {
        unit: 'bytes',
        decimals: 2,
      },
      specific: {
        mode: 'area',
        stackMode: 'normal',
        fillOpacity: 0.3,
      },
    },
  };
}

/**
 * 创建网络流量面板
 */
export function createNetworkTrafficPanel(): Panel {
  return {
    id: uuidv4(),
    name: '网络流量',
    description: '显示网络进出流量',
    type: 'timeseries' as PanelType,
    queries: [createQuery('network_traffic', '{{direction}}')],
    options: {
      chart: {
        smooth: true,
        showSymbol: false,
      },
      axis: {
        xAxis: { show: true, type: 'time' },
        yAxis: { show: true, min: 0 },
      },
      legend: {
        show: true,
        position: 'bottom',
      },
      format: {
        unit: 'bytes',
        decimals: 2,
      },
    },
  };
}

/**
 * 创建磁盘使用率面板
 */
export function createDiskUsagePanel(): Panel {
  return {
    id: uuidv4(),
    name: '磁盘使用率',
    description: '显示磁盘使用情况',
    type: 'pie' as PanelType,
    queries: [createQuery('disk_usage', '{{mount}}')],
    options: {
      legend: {
        show: true,
        position: 'right',
      },
      format: {
        unit: 'percent',
        decimals: 1,
      },
      specific: {
        pieType: 'doughnut',
        innerRadius: 50,
        showPercentage: true,
      },
    },
  };
}

/**
 * 创建统计值面板
 */
export function createStatPanel(name: string, expr: string, unit: string = 'none'): Panel {
  return {
    id: uuidv4(),
    name,
    type: 'stat' as PanelType,
    queries: [createQuery(expr)],
    options: {
      format: {
        unit: unit as any,
        decimals: 2,
      },
      specific: {
        displayMode: 'value-and-name',
        orientation: 'vertical',
        textAlign: 'center',
        showTrend: true,
      },
    },
  };
}

/**
 * 创建表格面板
 */
export function createTablePanel(): Panel {
  return {
    id: uuidv4(),
    name: '指标表格',
    description: '以表格形式展示指标数据',
    type: 'table' as PanelType,
    queries: [createQuery('cpu_usage')],
    options: {
      format: {
        decimals: 2,
      },
      specific: {
        showPagination: true,
        pageSize: 10,
        sortable: true,
      },
    },
  };
}

/**
 * 创建内存详细监控面板（使用 ListLegend 模式）
 */
export function createMemoryDetailsPanel(): Panel {
  return {
    id: uuidv4(),
    name: '内存详细监控',
    description: '显示各类内存使用情况（Apps、Cache、Slab、PageTables 等）',
    type: 'timeseries' as PanelType,
    queries: [
      createQuery('memory_apps', 'Apps - Memory used by user-space applications'),
      createQuery('memory_pagetables', 'PageTables - Memory used to map between virtual and physical memory'),
      createQuery('memory_swapcache', 'SwapCache - Memory that keeps track of pages that have been fetched from swap'),
      createQuery('memory_slab', 'Slab - Memory used by the kernel to cache data structures for its own use'),
      createQuery('memory_cache', 'Cache - Parked file data (file content) cache'),
      createQuery('memory_buffers', 'Buffers - In-memory block I/O buffers'),
    ],
    options: {
      chart: {
        smooth: false,
        showSymbol: false,
        colors: [
          '#5470c6', // 蓝色 - Apps
          '#91cc75', // 绿色 - PageTables
          '#fac858', // 黄色 - SwapCache
          '#ee6666', // 红色 - Slab
          '#73c0de', // 青色 - Cache
          '#3ba272', // 深绿 - Buffers
        ],
      },
      axis: {
        xAxis: { show: true, type: 'time' },
        yAxis: { show: true, min: 0 },
      },
      legend: {
        show: true,
        position: 'bottom',
        // mode 不在 chart.ts 的 LegendOptions 中，但可以在运行时使用
        ...({ mode: 'list' } as any),
      },
      format: {
        unit: 'bytes',
        decimals: 2,
      },
      specific: {
        mode: 'area',
        stackMode: 'normal',
        fillOpacity: 0.6,
      },
    },
  };
}

/**
 * 创建 Bar Chart 面板示例
 */
export function createBarChartPanel(name: string, expr: string, unit: string = 'none'): Panel {
  return {
    id: uuidv4(),
    name,
    description: '柱状图面板',
    type: 'bar' as PanelType,
    queries: [createQuery(expr)],
    options: {
      chart: {
        colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
      },
      axis: {
        xAxis: { show: true },
        yAxis: { show: true, min: 0 },
      },
      legend: {
        show: true,
        position: 'bottom',
      },
      format: {
        unit: unit as any,
        decimals: 2,
      },
      specific: {
        orientation: 'vertical',
        barMode: 'group',
        barWidth: '60%',
      },
    },
  };
}

/**
 * 创建 Gauge 面板示例
 */
export function createGaugePanel(name: string, expr: string, min: number = 0, max: number = 100): Panel {
  return {
    id: uuidv4(),
    name,
    description: '仪表盘面板',
    type: 'gauge' as PanelType,
    queries: [createQuery(expr)],
    options: {
      format: {
        unit: 'percent',
        decimals: 1,
      },
      specific: {
        min,
        max,
        showPointer: true,
        thresholds: [
          { value: 0, color: '#52c41a' }, // 绿色 0-60
          { value: 60, color: '#faad14' }, // 黄色 60-80
          { value: 80, color: '#ff4d4f' }, // 红色 80-100
        ],
      },
    },
  };
}
