import type { Ref } from 'vue';
import type { CanonicalQuery } from '@grafana-fast/types';
import { deepClone } from '/#/utils';
import { renderPromql } from './helpers';
import type { QueryDraft } from './types';

export function useQueryValidation(options: { queryDrafts: Ref<QueryDraft[]> }) {
  const { queryDrafts } = options;

  const validateDrafts = (purpose: 'save' | 'execute') => {
    const errors: Array<{ refId: string; message: string }> = [];

    for (const d of queryDrafts.value) {
      const shouldValidate = purpose === 'save' ? true : !d.hide;
      if (!shouldValidate) continue;
      const canUseBuilder = d.mode === 'builder' && d.builder.status === 'ok';
      const expr = canUseBuilder ? renderPromql(d.builder.visualQuery) : d.code.expr;
      if (!expr || !String(expr).trim()) {
        errors.push({ refId: d.refId || 'query', message: '表达式不能为空' });
      }
    }
    return { ok: errors.length === 0, errors };
  };

  const convertDraftsToCanonical = (purpose: 'save' | 'execute'): CanonicalQuery[] => {
    return queryDrafts.value.map((d) => {
      const canUseBuilder = d.mode === 'builder' && d.builder.status === 'ok';
      const expr = canUseBuilder ? renderPromql(d.builder.visualQuery) : d.code.expr;
      const out: CanonicalQuery = {
        id: d.id,
        refId: d.refId,
        expr: expr || '',
        legendFormat: d.code.legendFormat || '',
        minStep: d.code.minStep || 15,
        format: 'time_series',
        instant: false,
        hide: d.hide,
      };

      // 仅在 Builder 模式下持久化 visualQuery，保证与 expr 保持一致
      if (d.mode === 'builder' && d.builder.status === 'ok') {
        (out as any).visualQuery = deepClone(d.builder.visualQuery);
      }
      return out;
    });
  };

  return { validateDrafts, convertDraftsToCanonical };
}
