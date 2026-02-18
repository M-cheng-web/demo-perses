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
  /**
   * 可选：是否允许 emit（用于依赖未就绪时避免写回 props）
   *
   * 典型场景：
   * - 编辑器处于初始化/切换 sessionKey 中，暂不希望把草稿写回 props
   */
  canEmit?: () => boolean;
}) {
  const { getQueriesProp, getSessionKey, queryDrafts, resetFromProps, convertDraftsToCanonical, emitUpdateQueries, canEmit } = options;

  const lastEmittedSignature = ref<string>('');

  const canEmitNow = () => {
    try {
      return typeof canEmit === 'function' ? !!canEmit() : true;
    } catch {
      return false;
    }
  };

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

  const tryEmitQueries = () => {
    if (!canEmitNow()) return;
    const next = convertDraftsToCanonical('save');
    const sig = signatureFromCanonical(next);
    // 重要：避免“内部状态变化（例如解析 warnings）”导致重复 emit
    if (sig === lastEmittedSignature.value) return;
    lastEmittedSignature.value = sig;
    emitUpdateQueries(next);
  };

  const emitQueriesDebounced = debounceCancellable(() => {
    tryEmitQueries();
  }, 200);

  watch(
    queryDrafts,
    () => {
      emitQueriesDebounced();
    },
    { deep: true }
  );

  watch(
    () => canEmitNow(),
    (ok) => {
      if (!ok) {
        emitQueriesDebounced.cancel();
        return;
      }
      // 依赖就绪后立刻同步一次，避免“draft 已变更但因 canEmit=false 被跳过”的情况。
      tryEmitQueries();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    emitQueriesDebounced.cancel();
  });

  const markEmitted = (queries: CanonicalQuery[]) => {
    lastEmittedSignature.value = signatureFromCanonical(queries);
  };

  return { lastEmittedSignature, markEmitted };
}
