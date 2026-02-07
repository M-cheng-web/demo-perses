import type { QueryContext } from '@grafana-fast/types';
import type { QueryRunner } from '../queryRunner';
import { interpolateExpr } from '../interpolate';
import { resolveLoadingKindForRequest } from './viewState';
import type { PanelLoadingKind, PanelQueryPhase, PanelRegistration, RefreshTask } from './types';

interface RunPanelRequestDeps {
  runner: QueryRunner;
  absoluteTimeRange: { from: number; to: number };
  variablesValues: Record<string, string | string[]>;
  getConditionGeneration: () => number;
  minLoadingMs: number;
  pending: Map<string, RefreshTask>;
  setLoadingKind: (reg: PanelRegistration, kind: PanelLoadingKind) => void;
  setPanelPhase: (reg: PanelRegistration, phase: PanelQueryPhase) => void;
  markPanelDirty: (reg: PanelRegistration, dirty: boolean) => void;
  isPanelRendered: (panelId: string) => boolean;
  isPanelActive: (panelId: string) => boolean;
  deriveRegPassivePhase: (reg: PanelRegistration) => PanelQueryPhase;
}

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) return error.name === 'AbortError';
  if (typeof error !== 'object' || error == null) return false;
  return (error as { name?: unknown }).name === 'AbortError';
};

export async function runPanelRequest(reg: PanelRegistration, deps: RunPanelRequestDeps) {
  const panel = reg.getPanel();
  const queries = panel.queries ?? [];
  reg.abort?.abort();
  reg.abort = new AbortController();

  const token = (reg.loadingToken = reg.loadingToken + 1);
  const startedAt = Date.now();
  reg.inflight = true;
  reg.state.error.value = '';
  if (reg.loadingKind === 'none') {
    deps.setLoadingKind(reg, resolveLoadingKindForRequest(reg.hasSnapshot));
  }
  deps.setPanelPhase(reg, 'loading');

  const context: QueryContext = { timeRange: { from: deps.absoluteTimeRange.from, to: deps.absoluteTimeRange.to } };

  let aborted = false;

  try {
    const resolvedQueries = queries.map((q) => {
      const rawExpr = String(q.expr ?? '');
      const expr = interpolateExpr(rawExpr, deps.variablesValues, { multiFormat: 'regex', unknown: 'keep' });
      return expr === rawExpr ? q : { ...q, expr };
    });

    const results = await deps.runner.executeQueries(resolvedQueries, context, { signal: reg.abort.signal });
    reg.state.results.value = results;
    reg.hasSnapshot = true;
    deps.markPanelDirty(reg, false);
  } catch (err) {
    if (isAbortError(err)) {
      aborted = true;
    } else {
      reg.state.error.value = err instanceof Error ? err.message : '查询失败';
      reg.hasSnapshot = true;
      deps.markPanelDirty(reg, false);
    }
  } finally {
    reg.inflight = false;

    if (!aborted) {
      reg.lastLoadedConditionGen = deps.getConditionGeneration();
    }

    // Keep loading visible for a minimum time to avoid flicker.
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, deps.minLoadingMs - elapsed);

    const clearIfStillValid = () => {
      if (reg.loadingToken !== token) return;
      if (reg.inflight) return;
      if (deps.pending.has(reg.panelId)) return;

      if (aborted) {
        deps.setPanelPhase(reg, deps.deriveRegPassivePhase(reg));
        return;
      }

      if (!deps.isPanelRendered(reg.panelId)) {
        deps.setPanelPhase(reg, 'idle');
        return;
      }

      if (!deps.isPanelActive(reg.panelId)) {
        deps.setPanelPhase(reg, deps.deriveRegPassivePhase(reg));
        return;
      }

      deps.setPanelPhase(reg, deps.deriveRegPassivePhase(reg));
    };

    if (remaining <= 0) {
      clearIfStillValid();
    } else {
      globalThis.setTimeout(clearIfStillValid, remaining);
    }
  }
}
