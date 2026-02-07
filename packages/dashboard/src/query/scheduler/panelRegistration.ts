import { ref, watch } from 'vue';
import type { PanelQueryPhase, PanelQueryState, PanelRef, PanelRegistration, RefreshReason, RefreshTask } from './types';

interface CreatePanelRegistrationApiDeps {
  registrations: Map<string, PanelRegistration>;
  pending: Map<string, RefreshTask>;
  isPanelRendered: (panelId: string) => boolean;
  isPanelActive: (panelId: string) => boolean;
  isRegStale: (reg: PanelRegistration) => boolean;
  touchRegistration: (reg: PanelRegistration) => void;
  markRegistrationDetached: (reg: PanelRegistration) => void;
  cleanupDetachedRegistrations: () => void;
  setPanelPhase: (reg: PanelRegistration, phase: PanelQueryPhase) => void;
  deriveRegPassivePhase: (reg: PanelRegistration) => PanelQueryPhase;
  enqueue: (panelId: string, reason: RefreshReason, priority: number) => void;
}

export function createPanelRegistrationApi(deps: CreatePanelRegistrationApiDeps) {
  const ensureQueryWatch = (reg: PanelRegistration, panelRef: PanelRef) => {
    reg.stopQueryWatch?.();
    reg.stopQueryWatch = watch(
      () => panelRef.value.queries,
      () => {
        deps.enqueue(reg.panelId, 'panel-change', 30);
      },
      { deep: true }
    );
  };

  const registerPanel = (panelId: string, panelRef: PanelRef): PanelQueryState => {
    const existing = deps.registrations.get(panelId);

    if (existing) {
      existing.mounts++;
      deps.touchRegistration(existing);
      existing.getPanel = () => panelRef.value;
      ensureQueryWatch(existing, panelRef);

      if (deps.isPanelActive(panelId) && (!existing.hasSnapshot || deps.isRegStale(existing))) {
        deps.enqueue(panelId, 'became-visible', 25);
      } else {
        deps.setPanelPhase(existing, deps.deriveRegPassivePhase(existing));
      }

      return existing.state;
    }

    const state: PanelQueryState = {
      phase: ref('idle'),
      loadingKind: ref('none'),
      hasSnapshot: ref(false),
      stale: ref(false),
      error: ref(''),
      results: ref([]),
      refresh: () => {
        const reg = deps.registrations.get(panelId);
        if (reg) deps.enqueue(panelId, 'manual', 30);
      },
    };

    const reg: PanelRegistration = {
      panelId,
      getPanel: () => panelRef.value,
      state,
      abort: null,
      lastEnqueuedAt: 0,
      inflight: false,
      loadingToken: 0,
      mounts: 1,
      lastLoadedConditionGen: -1,
      dirty: false,
      hasSnapshot: false,
      loadingKind: 'none',
      lastDetachedAt: 0,
    };

    deps.touchRegistration(reg);
    deps.registrations.set(panelId, reg);
    ensureQueryWatch(reg, panelRef);

    if (deps.isPanelActive(panelId) && (!reg.hasSnapshot || deps.isRegStale(reg))) {
      deps.enqueue(panelId, 'became-visible', 25);
    } else {
      deps.setPanelPhase(reg, deps.deriveRegPassivePhase(reg));
    }

    return state;
  };

  const unregisterPanel = (panelId: string) => {
    const reg = deps.registrations.get(panelId);
    if (!reg) return;

    reg.mounts = Math.max(0, reg.mounts - 1);
    if (reg.mounts > 0) return;

    reg.stopQueryWatch?.();
    reg.stopQueryWatch = undefined;
    deps.pending.delete(panelId);

    if (!deps.isPanelRendered(panelId) && !deps.isPanelActive(panelId) && reg.inflight) {
      reg.abort?.abort();
    }

    if (!reg.inflight) {
      deps.setPanelPhase(reg, deps.deriveRegPassivePhase(reg));
    }

    deps.markRegistrationDetached(reg);
    deps.cleanupDetachedRegistrations();
  };

  return {
    registerPanel,
    unregisterPanel,
  };
}
