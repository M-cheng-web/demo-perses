/**
 * DataQueryTab 草稿生命周期编排：草稿状态、校验与对外 emit 同步。
 */
import type { CanonicalQuery } from '@grafana-fast/types';
import { useQueryDrafts } from './useQueryDrafts';
import { useQueryEmit } from './useQueryEmit';
import { useQueryValidation } from './useQueryValidation';

interface UseDataQueryTabDraftLifecycleOptions {
  getQueriesProp: () => CanonicalQuery[] | undefined;
  getSessionKey: () => string | number | undefined;
  emitUpdateQueries: (queries: CanonicalQuery[]) => void;
}

/**
 * 把 DataQueryTab 的“草稿 / 同步 / 校验 / 对外 emit”生命周期收敛到一个业务 hook。
 */
export function useDataQueryTabDraftLifecycle(options: UseDataQueryTabDraftLifecycleOptions) {
  const { getQueriesProp, getSessionKey, emitUpdateQueries } = options;

  const drafts = useQueryDrafts();

  const validation = useQueryValidation({ queryDrafts: drafts.queryDrafts });

  const { markEmitted } = useQueryEmit({
    getQueriesProp,
    getSessionKey,
    queryDrafts: drafts.queryDrafts,
    resetFromProps: drafts.resetFromProps,
    convertDraftsToCanonical: validation.convertDraftsToCanonical,
    emitUpdateQueries,
  });

  return {
    ...drafts,
    ...validation,
    markEmitted,
  };
}
