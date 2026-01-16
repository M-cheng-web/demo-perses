/**
 * 文件说明：VariableService 的 HTTP 实现（当前可用：初始化 + 透传 query-based 解析）
 *
 * 说明：
 * - 变量系统本身是“dashboard 运行时”的核心能力之一
 * - initialize 是纯前端归一化逻辑，不依赖后端，因此 http 实现可以直接完整实现
 * - resolveOptions 未来会通过 queryService.fetchVariableValues 对接真实 datasource/后端能力
 */

import type { VariableService } from '../../../contracts/variable';
import type { DashboardVariable, VariableOption, VariablesState } from '@grafana-fast/types';
import type { QueryService } from '../../../contracts/query';

export interface HttpVariableServiceDeps {
  queryService?: QueryService;
}

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

export function createHttpVariableService(deps: HttpVariableServiceDeps): VariableService {
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

    async resolveOptions(variables: DashboardVariable[], state: VariablesState): Promise<Record<string, VariableOption[]>> {
      const resolved: Record<string, VariableOption[]> = {};

      for (const v of variables) {
        // query 型变量：尝试通过 QueryService 解析 options（未来将对接真实后端/数据源）
        if (v.type === 'query' && v.query && deps.queryService?.fetchVariableValues) {
          try {
            const items = await deps.queryService.fetchVariableValues(v.query, { from: 'now-1h', to: 'now' });
            resolved[v.name] = items.map((it) => ({ text: it.text, value: it.value }));
            continue;
          } catch {
            // fall through to existing options
          }
        }

        resolved[v.name] = state.options[v.name] ?? normalizeOptions(v.options);
      }

      return resolved;
    },
  };
}

