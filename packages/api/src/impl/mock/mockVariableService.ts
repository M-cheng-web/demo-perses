/**
 * mock VariableService（后端全量下发变量）
 *
 * 说明：
 * - 该实现用于后端未就绪时的开发/演示
 * - 变量按 dashboardSessionKey 隔离存储（模拟“后端按 sessionKey 返回”）
 * - query 型变量的 options 在 mock 场景下会尝试通过 mock QueryService 生成
 */

import type { VariableService, VariablesRequestContext } from '../../contracts/variable';
import type { DashboardSessionKey, DashboardVariable, TimeRange, VariableOption } from '@grafana-fast/types';
import type { QueryService } from '../../contracts/query';
import { deepCloneStructured } from '@grafana-fast/utils';
import { resolveMockDashboardKeyBySessionKey } from './mockDashboardService';

const DEFAULT_TIME_RANGE: TimeRange = { from: 'now-1h', to: 'now' };

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
      options: [],
      current: ['default'],
    },
    {
      id: 'var-service',
      name: 'service',
      label: '服务',
      type: 'query',
      query: 'label_values(http_requests_total, job)',
      multi: false,
      options: [],
      current: 'api',
    },
    {
      id: 'var-instance',
      name: 'instance',
      label: '实例',
      type: 'query',
      query: 'label_values(up, instance)',
      multi: true,
      options: [],
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

async function hydrateQueryVariableOptions(input: DashboardVariable[], queryService?: QueryService, context?: VariablesRequestContext): Promise<DashboardVariable[]> {
  const out: DashboardVariable[] = [];
  for (const v of input) {
    const next: DashboardVariable = { ...v, options: normalizeOptions(v.options) };

    if (v.type === 'query' && v.query && queryService?.fetchVariableValues) {
      const items = await queryService.fetchVariableValues(String(v.query), DEFAULT_TIME_RANGE, {
        signal: context?.signal,
        dashboardSessionKey: context?.dashboardSessionKey,
      });
      next.options = items.map((it) => ({ text: String(it.text ?? it.value ?? ''), value: String(it.value ?? it.text ?? '') }));
    }

    out.push(next);
  }
  return out;
}

export function createMockVariableService(queryService?: QueryService): VariableService {
  return {
    async loadVariables(context?: VariablesRequestContext): Promise<DashboardVariable[]> {
      const sessionKey = requireSessionKey(context);
      // Validate sessionKey (throws on expired/not found), and implicitly ties variables to dashboardSessionKey scope.
      void resolveMockDashboardKeyBySessionKey(sessionKey);

      const existing = variablesBySessionKey.get(sessionKey);
      if (existing) return deepCloneStructured(existing);

      const initial = await hydrateQueryVariableOptions(buildDefaultVariables(), queryService, context);
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

      const next = await hydrateQueryVariableOptions(current, queryService, context);
      variablesBySessionKey.set(sessionKey, next);
      return deepCloneStructured(next);
    },
  };
}

