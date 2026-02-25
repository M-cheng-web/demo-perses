/**
 * mock VariableService（后端全量下发变量）
 *
 * 说明：
 * - 该实现用于后端未就绪时的开发/演示
 * - 变量按 dashboardSessionKey 隔离存储（模拟“后端按 sessionKey 返回”）
 */

import type { VariableService, VariablesRequestContext } from '../../contracts/variable';
import type { DashboardSessionKey, DashboardVariable, VariableOption } from '@grafana-fast/types';
import { deepCloneStructured } from '@grafana-fast/utils';
import { resolveMockDashboardKeyBySessionKey } from './mockDashboardService';

const variablesBySessionKey = new Map<DashboardSessionKey, DashboardVariable[]>();

function normalizeOptions(options: VariableOption[] | undefined): VariableOption[] {
  return (options ?? []).map((opt) => ({ text: opt.text ?? String(opt.value ?? ''), value: String(opt.value ?? opt.text ?? '') }));
}

function buildDefaultVariables(): DashboardVariable[] {
  return [
    {
      id: 'var-cluster',
      name: 'cluster',
      label: '集群',
      type: 'select',
      options: [
        { text: 'prod-a', value: 'prod-a' },
        { text: 'prod-b', value: 'prod-b' },
        { text: 'staging', value: 'staging' },
      ],
      current: 'prod-a',
    },
    {
      id: 'var-namespace',
      name: 'namespace',
      label: '命名空间',
      type: 'query',
      query: 'label_values(up, namespace)',
      multi: true,
      options: [
        { text: 'default', value: 'default' },
        { text: 'kube-system', value: 'kube-system' },
        { text: 'monitoring', value: 'monitoring' },
      ],
      current: ['default'],
    },
    {
      id: 'var-service',
      name: 'service',
      label: '服务',
      type: 'query',
      query: 'label_values(http_requests_total, job)',
      multi: false,
      options: [
        { text: 'api', value: 'api' },
        { text: 'web', value: 'web' },
        { text: 'gateway', value: 'gateway' },
      ],
      current: 'api',
    },
    {
      id: 'var-instance',
      name: 'instance',
      label: '实例',
      type: 'query',
      query: 'label_values(up, instance)',
      multi: true,
      options: [
        { text: 'server-1', value: 'server-1' },
        { text: 'server-2', value: 'server-2' },
      ],
      current: ['server-1'],
    },
    {
      id: 'var-window',
      name: 'window',
      label: '窗口',
      type: 'select',
      options: [
        { text: '1m', value: '1m' },
        { text: '5m', value: '5m' },
        { text: '10m', value: '10m' },
        { text: '15m', value: '15m' },
      ],
      current: '5m',
    },
  ];
}

function requireSessionKey(context?: VariablesRequestContext): DashboardSessionKey {
  const key = String(context?.dashboardSessionKey ?? '').trim();
  if (!key) throw new Error('[mockVariableService] Missing dashboardSessionKey');
  return key as DashboardSessionKey;
}

function normalizeVariables(input: DashboardVariable[]): DashboardVariable[] {
  return (input ?? []).map((v) => ({ ...v, options: normalizeOptions(v.options) }));
}

export function createMockVariableService(): VariableService {
  return {
    async loadVariables(context?: VariablesRequestContext): Promise<DashboardVariable[]> {
      const sessionKey = requireSessionKey(context);
      // Validate sessionKey (throws on expired/not found), and implicitly ties variables to dashboardSessionKey scope.
      void resolveMockDashboardKeyBySessionKey(sessionKey);

      const existing = variablesBySessionKey.get(sessionKey);
      if (existing) return deepCloneStructured(existing);

      const initial = normalizeVariables(buildDefaultVariables());
      variablesBySessionKey.set(sessionKey, initial);
      return deepCloneStructured(initial);
    },

    async applyVariables(values: Record<string, string | string[]>, context?: VariablesRequestContext): Promise<DashboardVariable[]> {
      const sessionKey = requireSessionKey(context);
      void resolveMockDashboardKeyBySessionKey(sessionKey);

      const current = deepCloneStructured(variablesBySessionKey.get(sessionKey) ?? buildDefaultVariables());
      const patch = values ?? {};

      for (const v of current) {
        const name = String(v.name ?? '').trim();
        if (!name) continue;
        if (!(name in patch)) continue;
        const nextValue = patch[name];
        v.current = Array.isArray(nextValue) ? nextValue.map((it) => String(it)) : String(nextValue ?? '');
      }

      const next = normalizeVariables(current);
      variablesBySessionKey.set(sessionKey, next);
      return deepCloneStructured(next);
    },
  };
}
