import type { Ref } from 'vue';
import type { CanonicalQuery, Datasource, DatasourceRef, PromVisualQuery } from '@grafana-fast/types';
import { parsePromqlToVisualQuery } from '@grafana-fast/utils';
import { deepClone } from '/#/utils';
import { getDatasourceRef, renderPromql } from './helpers';
import type { QueryDraft, QueryMode } from './types';

export function useQueryValidation(options: {
  queryMode: Ref<QueryMode>;
  queryDrafts: Ref<QueryDraft[]>;
  getDatasource: () => Pick<Datasource, 'id' | 'type' | 'name'> | null | undefined;
}) {
  const { queryMode, queryDrafts, getDatasource } = options;

  const validateDrafts = (purpose: 'save' | 'execute') => {
    const errors: Array<{ refId: string; message: string }> = [];
    for (const d of queryDrafts.value) {
      const shouldValidate = purpose === 'save' ? true : !d.hide;
      if (!shouldValidate) continue;
      const canUseBuilder =
        queryMode.value === 'builder' && d.builder.status === 'ok' && (d.builder.confidence === 'exact' || !!d.builder.acceptedPartial);
      const expr = canUseBuilder ? renderPromql(d.builder.visualQuery) : d.code.expr;
      if (!expr || !String(expr).trim()) {
        errors.push({ refId: d.refId || 'query', message: '表达式不能为空' });
      }
    }
    return { ok: errors.length === 0, errors };
  };

  const convertDraftsToCanonical = (purpose: 'save' | 'execute'): CanonicalQuery[] => {
    const datasourceRef: DatasourceRef = getDatasourceRef(getDatasource());
    return queryDrafts.value.map((d) => {
      const canUseBuilder =
        queryMode.value === 'builder' && d.builder.status === 'ok' && (d.builder.confidence === 'exact' || !!d.builder.acceptedPartial);
      const expr = canUseBuilder ? renderPromql(d.builder.visualQuery) : d.code.expr;
      const out: CanonicalQuery = {
        id: d.id,
        refId: d.refId,
        datasourceRef,
        expr: expr || '',
        legendFormat: d.code.legendFormat || '',
        minStep: d.code.minStep || 15,
        format: 'time_series',
        instant: false,
        hide: d.hide,
      };

      // 只在“exact 或已接受 partial”时持久化 visualQuery，避免把“未确认的过滤结果”写入面板配置
      if (d.builder.status === 'ok' && (d.builder.confidence === 'exact' || !!d.builder.acceptedPartial)) {
        (out as any).visualQuery = deepClone(d.builder.visualQuery);
      } else if (purpose === 'save') {
        const parsed = parsePromqlToVisualQuery(expr || '');
        if (parsed.ok && parsed.confidence === 'exact') {
          (out as any).visualQuery = deepClone(parsed.value) as PromVisualQuery;
        }
      }
      return out;
    });
  };

  return { validateDrafts, convertDraftsToCanonical };
}
