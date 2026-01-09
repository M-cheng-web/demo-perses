/**
 * @fileoverview Prometheus API 接口
 * @description
 *   模拟 Prometheus HTTP API 的接口实现。
 *       主要功能：
 *       - fetchMetrics: 获取指标列表
 *       - fetchLabelKeys: 获取指定指标的标签键
 *       - fetchLabelValues: 获取指定标签的值列表
 *       - queryRange: 范围查询（时间序列数据）
 *       - queryInstant: 即时查询（当前值）
 *       - queryLabelKeys: 查询可用标签（用于 LabelParamEditor）
 * @reference Grafana 源码
 *   grafana/public/app/plugins/datasource/prometheus/datasource.ts
 */
/**
 * 模拟 Prometheus API 服务
 */

// 模拟的指标列表
const mockMetrics = [
  'up',
  'node_cpu_seconds_total',
  'node_memory_MemTotal_bytes',
  'node_memory_MemFree_bytes',
  'node_memory_MemAvailable_bytes',
  'node_disk_read_bytes_total',
  'node_disk_written_bytes_total',
  'node_network_receive_bytes_total',
  'node_network_transmit_bytes_total',
  'http_requests_total',
  'http_request_duration_seconds',
  'process_cpu_seconds_total',
  'process_resident_memory_bytes',
  'go_goroutines',
  'prometheus_http_requests_total',
  'prometheus_tsdb_head_samples',
  'container_cpu_usage_seconds_total',
  'container_memory_usage_bytes',
  'kube_pod_status_phase',
  'kube_deployment_status_replicas',
];

// 模拟的标签键
const mockLabelKeys: Record<string, string[]> = {
  up: ['job', 'instance'],
  node_cpu_seconds_total: ['cpu', 'mode', 'instance', 'job'],
  node_memory_MemTotal_bytes: ['instance', 'job'],
  node_memory_MemFree_bytes: ['instance', 'job'],
  node_memory_MemAvailable_bytes: ['instance', 'job'],
  node_disk_read_bytes_total: ['device', 'instance', 'job'],
  node_disk_written_bytes_total: ['device', 'instance', 'job'],
  node_network_receive_bytes_total: ['device', 'instance', 'job'],
  node_network_transmit_bytes_total: ['device', 'instance', 'job'],
  http_requests_total: ['method', 'status', 'endpoint', 'instance', 'job'],
  http_request_duration_seconds: ['method', 'status', 'endpoint', 'instance', 'job'],
  process_cpu_seconds_total: ['instance', 'job'],
  process_resident_memory_bytes: ['instance', 'job'],
  go_goroutines: ['instance', 'job'],
  prometheus_http_requests_total: ['handler', 'code', 'instance', 'job'],
  prometheus_tsdb_head_samples: ['instance', 'job'],
  container_cpu_usage_seconds_total: ['container', 'pod', 'namespace', 'instance'],
  container_memory_usage_bytes: ['container', 'pod', 'namespace', 'instance'],
  kube_pod_status_phase: ['pod', 'namespace', 'phase'],
  kube_deployment_status_replicas: ['deployment', 'namespace'],
};

// 模拟的标签值
const mockLabelValues: Record<string, Record<string, string[]>> = {
  node_cpu_seconds_total: {
    cpu: ['0', '1', '2', '3', '4', '5', '6', '7'],
    mode: ['idle', 'user', 'system', 'iowait', 'steal', 'irq', 'softirq'],
    instance: ['localhost:9100', '192.168.1.100:9100', '192.168.1.101:9100'],
    job: ['node-exporter'],
  },
  http_requests_total: {
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    status: ['200', '201', '204', '400', '404', '500', '503'],
    endpoint: ['/api/users', '/api/products', '/api/orders', '/health', '/metrics'],
    instance: ['localhost:8080', '192.168.1.10:8080', '192.168.1.11:8080'],
    job: ['api-server'],
  },
  kube_pod_status_phase: {
    pod: ['nginx-deployment-1', 'nginx-deployment-2', 'api-service-1', 'database-0'],
    namespace: ['default', 'kube-system', 'production', 'staging'],
    phase: ['Running', 'Pending', 'Failed', 'Succeeded'],
  },
};

/**
 * 模拟获取指标列表
 */
export async function fetchMetrics(search?: string): Promise<string[]> {
  // 模拟网络延迟
  await delay(200);

  if (!search) {
    return mockMetrics.slice(0, 10);
  }

  const lowerSearch = search.toLowerCase();
  return mockMetrics.filter((metric) => metric.toLowerCase().includes(lowerSearch));
}

/**
 * 模拟获取指标的标签键
 */
export async function fetchLabelKeys(metric: string): Promise<string[]> {
  await delay(150);

  const keys = mockLabelKeys[metric];
  if (keys) {
    return keys;
  }

  // 默认返回常用标签
  return ['instance', 'job'];
}

/**
 * 模拟获取标签值
 */
export async function fetchLabelValues(metric: string, labelKey: string, _otherLabels?: Record<string, string>): Promise<string[]> {
  await delay(150);

  const metricLabels = mockLabelValues[metric];
  if (metricLabels && metricLabels[labelKey]) {
    return metricLabels[labelKey];
  }

  // 根据标签键返回通用值
  const defaultValues: Record<string, string[]> = {
    instance: ['localhost:9090', '192.168.1.100:9090', '192.168.1.101:9090'],
    job: ['prometheus', 'node-exporter', 'cadvisor', 'api-server'],
    pod: ['pod-1', 'pod-2', 'pod-3'],
    namespace: ['default', 'kube-system', 'production'],
    container: ['main', 'sidecar', 'init'],
    device: ['eth0', 'eth1', 'lo'],
    mode: ['user', 'system', 'idle'],
    cpu: ['0', '1', '2', '3'],
    status: ['200', '404', '500'],
    method: ['GET', 'POST', 'PUT', 'DELETE'],
  };

  return defaultValues[labelKey] || ['value1', 'value2', 'value3'];
}

/**
 * 模拟查询 PromQL
 */
export async function queryPrometheus(query: string, _time?: string): Promise<any> {
  await delay(300);

  // 生成模拟的时间序列数据
  const now = Date.now() / 1000;
  const values: [number, string][] = [];

  for (let i = 60; i >= 0; i--) {
    const timestamp = now - i * 60; // 每分钟一个点
    const value = Math.random() * 100 + Math.sin(i / 10) * 20;
    values.push([timestamp, value.toFixed(2)]);
  }

  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [
        {
          metric: {
            __name__: extractMetricName(query),
            job: 'api-server',
            instance: 'localhost:8080',
          },
          values,
        },
        {
          metric: {
            __name__: extractMetricName(query),
            job: 'api-server',
            instance: 'localhost:8081',
          },
          values: values.map(([t, v]) => [t, (parseFloat(v) * 0.8).toFixed(2)]),
        },
      ],
    },
  };
}

/**
 * 模拟查询范围数据
 */
export async function queryRange(params: { query: string; start: string; end: string; step: string }): Promise<any> {
  await delay(300);

  const { query, start, end, step } = params;

  // 如果 query 为空或不是字符串，返回空结果
  if (!query || typeof query !== 'string') {
    return {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [],
      },
    };
  }

  // 解析时间范围
  const startTime = new Date(start).getTime() / 1000; // 转换为秒
  const endTime = new Date(end).getTime() / 1000;
  const stepSeconds = parseStepToSeconds(step);

  const values: [number, string][] = [];
  const numPoints = Math.min(100, Math.floor((endTime - startTime) / stepSeconds));

  for (let i = 0; i < numPoints; i++) {
    const timestamp = startTime + i * stepSeconds;
    const value = Math.random() * 100 + Math.sin(i / 5) * 30 + 50;
    values.push([timestamp, value.toFixed(2)]);
  }

  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [
        {
          metric: {
            __name__: extractMetricName(query),
            instance: 'localhost:8080',
          },
          values,
        },
      ],
    },
  };
}

// 解析 step 字符串为秒数（如 "15s" -> 15, "1m" -> 60）
function parseStepToSeconds(step: string): number {
  const match = step.match(/^(\d+)([smhd]?)$/);
  if (!match) return 15; // 默认 15 秒

  const value = parseInt(match[1]);
  const unit = match[2] || 's';

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * 模拟获取序列标签
 */
export async function fetchSeriesLabels(match: string, _start?: number, _end?: number): Promise<any[]> {
  await delay(200);

  return [
    {
      __name__: extractMetricName(match),
      job: 'api-server',
      instance: 'localhost:8080',
    },
    {
      __name__: extractMetricName(match),
      job: 'api-server',
      instance: 'localhost:8081',
    },
    {
      __name__: extractMetricName(match),
      job: 'node-exporter',
      instance: 'localhost:9100',
    },
  ];
}

// 辅助函数

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMetricName(query: string): string {
  // 简单的指标名称提取
  const match = query.match(/([a-zA-Z_][a-zA-Z0-9_]*)/);
  return match ? match[1] : 'unknown_metric';
}

/**
 * 模拟获取所有标签名称
 */
export async function fetchAllLabelNames(): Promise<string[]> {
  await delay(100);

  return [
    '__name__',
    'instance',
    'job',
    'pod',
    'namespace',
    'container',
    'device',
    'mode',
    'cpu',
    'status',
    'method',
    'endpoint',
    'handler',
    'code',
    'phase',
    'deployment',
  ];
}

/**
 * 模拟根据查询表达式获取可用的标签名称（用于聚合操作）
 * 这个函数模拟 Grafana 的 languageProvider.queryLabelKeys
 */
export async function queryLabelKeys(expr: string): Promise<string[]> {
  await delay(150);

  // 从表达式中提取指标名称
  const metricName = extractMetricName(expr);

  // 如果有对应的标签键，返回它们
  if (mockLabelKeys[metricName]) {
    return mockLabelKeys[metricName];
  }

  // 否则返回通用标签键
  return ['instance', 'job', 'pod', 'namespace', 'container', 'device', 'mode', 'cpu'];
}

/**
 * 模拟验证 PromQL 查询
 */
export async function validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
  await delay(100);

  if (!query || query.trim().length === 0) {
    return { valid: false, error: '查询不能为空' };
  }

  // 简单的语法检查
  const openBrackets = (query.match(/\(/g) || []).length;
  const closeBrackets = (query.match(/\)/g) || []).length;

  if (openBrackets !== closeBrackets) {
    return { valid: false, error: '括号不匹配' };
  }

  const openBraces = (query.match(/\{/g) || []).length;
  const closeBraces = (query.match(/\}/g) || []).length;

  if (openBraces !== closeBraces) {
    return { valid: false, error: '花括号不匹配' };
  }

  return { valid: true };
}
