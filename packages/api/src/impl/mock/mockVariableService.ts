/**
 * mock VariableService
 *
 * 说明：
 * - initialize：把 Dashboard JSON 的变量定义转换为运行时 values/options
 * - resolveOptions：对 query 型变量（type='query'）尝试调用 mock QueryService 拉取 options
 */
import type { VariableService } from '../../contracts';
import type { DashboardVariable, TimeRange, VariableOption, VariablesState } from '@grafana-fast/types';
import type { QueryService } from '../../contracts/query';
import type { ResolveVariableOptionsContext } from '../../contracts/variable';

function normalizeCurrent(variable: DashboardVariable): string | string[] {
  if (variable.multi) {
    if (Array.isArray(variable.current)) return variable.current;
    if (typeof variable.current === 'string' && variable.current) return [variable.current];
    return [];
  }
  return Array.isArray(variable.current) ? (variable.current[0] ?? '') : (variable.current ?? '');
}

function normalizeOptions(options: VariableOption[] | undefined): VariableOption[] {
  return (options ?? []).map((opt) => ({ text: opt.text ?? String(opt.value ?? ''), value: String(opt.value ?? opt.text ?? '') }));
}

export function createMockVariableService(queryService?: QueryService): VariableService {
  return {
    initialize(variables: DashboardVariable[] | undefined): VariablesState {
      const values: Record<string, string | string[]> = {};
      const options: Record<string, VariableOption[]> = {};
      for (const v of variables ?? []) {
        values[v.name] = normalizeCurrent(v);
        options[v.name] = normalizeOptions(v.options);
      }
      return { values, options, lastUpdatedAt: Date.now() };
    },

    async resolveOptions(
      variables: DashboardVariable[],
      state: VariablesState,
      timeRange: TimeRange,
      context?: ResolveVariableOptionsContext
    ): Promise<Record<string, VariableOption[]>> {
      const resolved: Record<string, VariableOption[]> = {};

      for (const v of variables) {
        // query 型变量：尝试通过 QueryService 解析 options（模拟远端数据源拉取）
        if (v.type === 'query' && v.query && queryService?.fetchVariableValues) {
          const items = await queryService.fetchVariableValues(v.query, timeRange, {
            signal: context?.signal,
            dashboardSessionKey: context?.dashboardSessionKey,
          });
          const opts: VariableOption[] = items.map((it) => ({ text: it.text, value: it.value }));
          resolved[v.name] = opts;
          continue;
        }

        resolved[v.name] = state.options[v.name] ?? normalizeOptions(v.options);
      }

      return resolved;
    },
  };
}
