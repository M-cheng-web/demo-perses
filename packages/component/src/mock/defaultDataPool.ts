/**
 * 默认数据池
 * 当 localStorage 中没有数据时，提供默认的时间序列数据
 */

import type { TimeSeriesData } from '@grafana-fast/types';

/**
 * 生成时间序列数据点
 * @param startTime 开始时间戳
 * @param count 数据点数量
 * @param interval 时间间隔（毫秒）
 * @param baseValue 基础值
 * @param variance 波动范围
 * @param trend 趋势系数（正数为上升，负数为下降）
 */
function generateTimeSeriesValues(
  startTime: number,
  count: number,
  interval: number,
  baseValue: number,
  variance: number,
  trend: number = 0
): [number, number][] {
  const values: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * interval;
    const trendValue = baseValue + trend * i;
    const randomVariance = (Math.random() - 0.5) * variance * 2;
    const value = Math.max(0, trendValue + randomVariance);
    values.push([timestamp, parseFloat(value.toFixed(2))]);
  }

  return values;
}

/**
 * 生成正弦波数据（用于周期性数据）
 */
function generateSineWaveValues(
  startTime: number,
  count: number,
  interval: number,
  amplitude: number,
  offset: number,
  frequency: number = 1
): [number, number][] {
  const values: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * interval;
    const value = offset + amplitude * Math.sin((i * frequency * Math.PI) / 180);
    values.push([timestamp, parseFloat(value.toFixed(2))]);
  }

  return values;
}

/**
 * 获取默认时间范围
 */
function getDefaultTimeRange(): { start: number; end: number; interval: number; count: number } {
  const end = Date.now();
  const start = end - 3 * 60 * 60 * 1000; // 最近3小时
  const interval = 3 * 60 * 1000; // 每3分钟一个点
  const count = 60; // 60个数据点

  return { start, end, interval, count };
}

/**
 * 默认数据池 - 按照指标类型组织
 */
export const DEFAULT_DATA_POOL = {
  // CPU 相关指标
  cpu: {
    cpu_usage: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: 'CPU Core 1',
            core: '1',
            instance: 'server-1',
          },
          // 基础值35%，波动8%，轻微上升趋势
          values: generateTimeSeriesValues(start, count, interval, 35, 8, 0.05),
        },
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: 'CPU Core 2',
            core: '2',
            instance: 'server-1',
          },
          // 基础值42%，波动10%，轻微上升趋势
          values: generateTimeSeriesValues(start, count, interval, 42, 10, 0.08),
        },
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: 'CPU Core 3',
            core: '3',
            instance: 'server-1',
          },
          // 基础值28%，波动7%，平稳
          values: generateTimeSeriesValues(start, count, interval, 28, 7, 0),
        },
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: 'CPU Core 4',
            core: '4',
            instance: 'server-1',
          },
          // 基础值38%，波动9%，平稳
          values: generateTimeSeriesValues(start, count, interval, 38, 9, 0.02),
        },
      ];
    },
    avg_cpu_usage: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: '平均 CPU 使用率',
          },
          // 平均值约35.75%，小波动
          values: generateTimeSeriesValues(start, count, interval, 35.75, 4, 0.04),
        },
      ];
    },
    max_cpu_usage: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'cpu_usage',
            __legend__: '最大 CPU 使用率',
          },
          // 最大值约54%，中等波动
          values: generateTimeSeriesValues(start, count, interval, 54, 8, 0.08),
        },
      ];
    },
  },

  // 内存相关指标
  memory: {
    memory_usage: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'memory_usage',
            __legend__: '已使用内存',
            type: 'used',
            instance: 'server-1',
          },
          // 12.5 GB，逐渐增长（模拟内存泄漏或正常使用增长）
          values: generateTimeSeriesValues(start, count, interval, 12.5, 0.8, 0.015),
        },
        {
          metric: {
            __name__: 'memory_usage',
            __legend__: '缓存内存',
            type: 'cached',
            instance: 'server-1',
          },
          // 3.2 GB，较稳定
          values: generateTimeSeriesValues(start, count, interval, 3.2, 0.3, 0.005),
        },
        {
          metric: {
            __name__: 'memory_usage',
            __legend__: '缓冲内存',
            type: 'buffer',
            instance: 'server-1',
          },
          // 1.8 GB，非常稳定
          values: generateTimeSeriesValues(start, count, interval, 1.8, 0.15, 0),
        },
      ];
    },
    total_memory: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'memory_total',
            __legend__: '总内存',
          },
          values: Array(count)
            .fill(0)
            .map((_, i) => [start + i * interval, 16]),
        },
      ];
    },
    available_memory: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'memory_available',
            __legend__: '可用内存',
          },
          // 5.2 GB，随着使用内存增加而缓慢减少
          values: generateTimeSeriesValues(start, count, interval, 5.2, 0.5, -0.012),
        },
      ];
    },
  },

  // 网络相关指标
  network: {
    network_traffic: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'network_bytes',
            __legend__: '入站流量',
            direction: 'rx',
            interface: 'eth0',
          },
          values: generateSineWaveValues(start, count, interval, 5000, 15000, 2),
        },
        {
          metric: {
            __name__: 'network_bytes',
            __legend__: '出站流量',
            direction: 'tx',
            interface: 'eth0',
          },
          values: generateSineWaveValues(start, count, interval, 3000, 8000, 2.5),
        },
      ];
    },
    total_network_traffic: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      const rx = generateSineWaveValues(start, count, interval, 5000, 15000, 2);
      const tx = generateSineWaveValues(start, count, interval, 3000, 8000, 2.5);

      return [
        {
          metric: {
            __name__: 'network_bytes_total',
            __legend__: '总流量',
          },
          values: rx.map((v, i) => [v[0], v[1] + (tx[i]?.[1] ?? 0)]),
        },
      ];
    },
  },

  // 磁盘相关指标
  disk: {
    disk_usage: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'disk_used',
            __legend__: '已使用空间',
            device: '/dev/sda1',
            mountpoint: '/',
          },
          values: generateTimeSeriesValues(start, count, interval, 285, 5, 0.08),
        },
        {
          metric: {
            __name__: 'disk_free',
            __legend__: '剩余空间',
            device: '/dev/sda1',
            mountpoint: '/',
          },
          values: generateTimeSeriesValues(start, count, interval, 215, 5, -0.08),
        },
      ];
    },
  },

  // 系统性能指标
  system: {
    system_load: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'load_average',
            __legend__: '系统负载',
            period: '1m',
          },
          // 1分钟平均负载约1.8（4核系统，低于50%）
          values: generateTimeSeriesValues(start, count, interval, 1.8, 0.6, 0),
        },
      ];
    },
    process_count: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'processes',
            __legend__: '进程数量',
          },
          // 约182个进程，小幅波动
          values: generateTimeSeriesValues(start, count, interval, 182, 8, 0),
        },
      ];
    },
    thread_count: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'threads',
            __legend__: '线程数量',
          },
          // 约1245个线程，中等波动
          values: generateTimeSeriesValues(start, count, interval, 1245, 50, 0),
        },
      ];
    },
    system_health: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'health_score',
            __legend__: '系统健康度',
          },
          // 健康度92分（满分100），小波动
          values: generateTimeSeriesValues(start, count, interval, 92, 3, 0),
        },
      ];
    },
  },

  // 请求相关指标
  requests: {
    request_rate: (): TimeSeriesData[] => {
      const { start, interval, count } = getDefaultTimeRange();
      return [
        {
          metric: {
            __name__: 'http_requests_total',
            __legend__: 'GET 请求',
            method: 'GET',
          },
          values: generateSineWaveValues(start, count, interval, 50, 120, 3),
        },
        {
          metric: {
            __name__: 'http_requests_total',
            __legend__: 'POST 请求',
            method: 'POST',
          },
          values: generateSineWaveValues(start, count, interval, 30, 80, 3),
        },
        {
          metric: {
            __name__: 'http_requests_total',
            __legend__: 'PUT 请求',
            method: 'PUT',
          },
          values: generateSineWaveValues(start, count, interval, 15, 40, 3),
        },
      ];
    },
  },
};

/**
 * 根据查询表达式获取默认数据
 * @param expr Prometheus 查询表达式
 * @returns 时间序列数据数组
 */
export function getDefaultDataByExpr(expr: string): TimeSeriesData[] {
  // 简单的表达式匹配
  const lowerExpr = expr.toLowerCase();

  // CPU 指标
  if (lowerExpr.includes('cpu_usage') || lowerExpr.includes('cpu使用率')) {
    if (lowerExpr.includes('avg')) {
      return DEFAULT_DATA_POOL.cpu.avg_cpu_usage();
    }
    if (lowerExpr.includes('max')) {
      return DEFAULT_DATA_POOL.cpu.max_cpu_usage();
    }
    return DEFAULT_DATA_POOL.cpu.cpu_usage();
  }

  // 内存指标
  if (lowerExpr.includes('memory_usage') || lowerExpr.includes('内存使用')) {
    return DEFAULT_DATA_POOL.memory.memory_usage();
  }
  if (lowerExpr.includes('memory_total') || lowerExpr.includes('总内存')) {
    return DEFAULT_DATA_POOL.memory.total_memory();
  }
  if (lowerExpr.includes('memory_available') || lowerExpr.includes('可用内存')) {
    return DEFAULT_DATA_POOL.memory.available_memory();
  }

  // 网络指标
  if (lowerExpr.includes('network') || lowerExpr.includes('网络')) {
    if (lowerExpr.includes('sum') || lowerExpr.includes('total') || lowerExpr.includes('总')) {
      return DEFAULT_DATA_POOL.network.total_network_traffic();
    }
    return DEFAULT_DATA_POOL.network.network_traffic();
  }

  // 磁盘指标
  if (lowerExpr.includes('disk') || lowerExpr.includes('磁盘')) {
    return DEFAULT_DATA_POOL.disk.disk_usage();
  }

  // 系统指标
  if (lowerExpr.includes('system_load') || lowerExpr.includes('系统负载')) {
    return DEFAULT_DATA_POOL.system.system_load();
  }
  if (lowerExpr.includes('process_count') || lowerExpr.includes('进程')) {
    return DEFAULT_DATA_POOL.system.process_count();
  }
  if (lowerExpr.includes('thread_count') || lowerExpr.includes('线程')) {
    return DEFAULT_DATA_POOL.system.thread_count();
  }
  if (lowerExpr.includes('system_health') || lowerExpr.includes('健康')) {
    return DEFAULT_DATA_POOL.system.system_health();
  }

  // 请求指标
  if (lowerExpr.includes('request') || lowerExpr.includes('请求')) {
    return DEFAULT_DATA_POOL.requests.request_rate();
  }

  // 默认返回 CPU 数据
  console.warn(`No matching default data for expression: ${expr}, returning CPU usage data`);
  return DEFAULT_DATA_POOL.cpu.cpu_usage();
}

/**
 * 获取所有可用的默认数据键
 */
export function getAvailableDataKeys(): string[] {
  return [
    'cpu_usage',
    'avg(cpu_usage)',
    'max(cpu_usage)',
    'memory_usage',
    'memory_total',
    'memory_available',
    'network_traffic',
    'sum(network_traffic)',
    'disk_usage',
    'system_load',
    'process_count',
    'thread_count',
    'system_health',
    'request_rate',
  ];
}
