import type { CanonicalQuery, Datasource } from '@grafana-fast/types';
import type { Ref } from 'vue';
import { useQueryDrafts } from './useQueryDrafts';
import { useQueryEmit } from './useQueryEmit';
import { useQueryModeSync } from './useQueryModeSync';
import { useQueryValidation } from './useQueryValidation';
import type { QueryMode } from './types';

interface UseDataQueryTabDraftLifecycleOptions {
  queryMode: Ref<QueryMode>;
  datasource: () => Pick<Datasource, 'id' | 'type' | 'name'> | null | undefined;
  getQueriesProp: () => CanonicalQuery[] | undefined;
  getSessionKey: () => string | number | undefined;
  emitUpdateQueries: (queries: CanonicalQuery[]) => void;
}

/**
 * 把 DataQueryTab 的“草稿 / 同步 / 校验 / 对外 emit”生命周期收敛到一个业务 hook。
 */
export function useDataQueryTabDraftLifecycle(options: UseDataQueryTabDraftLifecycleOptions) {
  const { queryMode, datasource, getQueriesProp, getSessionKey, emitUpdateQueries } = options;

  const drafts = useQueryDrafts();

  useQueryModeSync({ queryMode, queryDrafts: drafts.queryDrafts });

  const validation = useQueryValidation({
    queryMode,
    queryDrafts: drafts.queryDrafts,
    getDatasource: datasource,
  });

  const { markEmitted } = useQueryEmit({
    getQueriesProp,
    getSessionKey,
    queryDrafts: drafts.queryDrafts,
    resetFromProps: drafts.resetFromProps,
    convertDraftsToCanonical: validation.convertDraftsToCanonical,
    emitUpdateQueries,
    canEmit: () => {
      const ds = datasource();
      const id = String(ds?.id ?? '').trim();
      return !!id;
    },
  });

  return {
    ...drafts,
    ...validation,
    markEmitted,
  };
}
