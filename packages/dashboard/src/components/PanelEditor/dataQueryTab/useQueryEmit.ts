import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { CanonicalQuery } from '@grafana-fast/types';
import { debounceCancellable } from '/#/utils';
import { signatureFromCanonical } from './helpers';
import type { QueryDraft } from './types';

export function useQueryEmit(options: {
  getQueriesProp: () => CanonicalQuery[] | undefined;
  getSessionKey: () => string | number | undefined;
  queryDrafts: Ref<QueryDraft[]>;
  resetFromProps: (nextQueries?: CanonicalQuery[]) => void;
  convertDraftsToCanonical: (purpose: 'save' | 'execute') => CanonicalQuery[];
  emitUpdateQueries: (queries: CanonicalQuery[]) => void;
}) {
  const { getQueriesProp, getSessionKey, queryDrafts, resetFromProps, convertDraftsToCanonical, emitUpdateQueries } = options;

  const lastEmittedSignature = ref<string>('');

  watch(
    () => getQueriesProp(),
    (next) => {
      const sig = signatureFromCanonical(next);
      // 忽略由我们自身 emit('update:queries', ...) 引起的 props 回写更新
      if (sig === lastEmittedSignature.value) return;
      resetFromProps(next as any);
    },
    { deep: true, immediate: true }
  );

  watch(
    () => getSessionKey(),
    () => {
      // sessionKey 变化时强制重置（例如切换面板）
      lastEmittedSignature.value = '';
      resetFromProps(getQueriesProp());
    }
  );

  const emitQueriesDebounced = debounceCancellable(() => {
    const next = convertDraftsToCanonical('save');
    const sig = signatureFromCanonical(next);
    // 重要：避免“内部状态变化（例如解析 warnings）”导致重复 emit
    if (sig === lastEmittedSignature.value) return;
    lastEmittedSignature.value = sig;
    emitUpdateQueries(next);
  }, 200);

  watch(
    queryDrafts,
    () => {
      emitQueriesDebounced();
    },
    { deep: true }
  );

  onBeforeUnmount(() => {
    emitQueriesDebounced.cancel();
  });

  const markEmitted = (queries: CanonicalQuery[]) => {
    lastEmittedSignature.value = signatureFromCanonical(queries);
  };

  return { lastEmittedSignature, markEmitted };
}
