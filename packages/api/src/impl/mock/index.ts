/**
 * mock 实现入口
 *
 * 说明：
 * - 当后端未就绪时，dashboard 默认使用 mock 实现，保证开发/演示可用
 * - mock 内部仍遵循 contracts：方法名与返回结构尽量与未来保持一致
 */
import type { GrafanaFastApiClient } from '../../contracts';
import { createMockDashboardService } from './mockDashboardService';
import { createMockQueryService } from './mockQueryService';
import { createMockVariableService } from './mockVariableService';

/**
 * 创建 mock API client
 */
export function createMockApiClient(): GrafanaFastApiClient {
  const query = createMockQueryService();
  return {
    kind: 'mock',
    dashboard: createMockDashboardService(),
    query,
    variable: createMockVariableService(query),
  };
}
