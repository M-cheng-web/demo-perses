import type { PanelLoadingKind, PanelQueryPhase } from './types';

export const LOADING_PHASES = new Set<PanelQueryPhase>(['waiting', 'queued', 'loading']);

interface PassivePhaseInput {
  rendered: boolean;
  mounted: boolean;
  hasSnapshot: boolean;
  hasError: boolean;
  pending: boolean;
  inflight: boolean;
}

export function derivePassivePhase(input: PassivePhaseInput): PanelQueryPhase {
  if (!input.rendered) {
    // 首次挂载时，VirtualList 可能尚未上报 viewport，短窗口内先进入 waiting，避免首帧闪白。
    if (input.mounted && !input.hasSnapshot) return 'waiting';
    return 'idle';
  }
  if (input.pending) return 'queued';
  if (input.inflight) return 'loading';
  if (!input.hasSnapshot) return 'waiting';
  if (input.hasError) return 'error';
  return 'ready';
}

export function resolveLoadingKindForRequest(hasSnapshot: boolean): PanelLoadingKind {
  return hasSnapshot ? 'refreshing' : 'blocking';
}
