import { onBeforeUnmount, type Ref } from 'vue';

export interface LayoutItemLike {
  i: string;
}

export function useRafBatchedLayoutModel<T extends LayoutItemLike>(layoutModel: Ref<T[]>) {
  let pendingLayoutModel: T[] | null = null;
  let rafId: number | null = null;

  const applyLayoutModelUpdate = (nextLayout: T[]) => {
    const currentById = new Map<string, T>();
    layoutModel.value.forEach((it) => currentById.set(String(it.i), it));

    const nextRefs: T[] = [];
    for (const next of nextLayout) {
      const id = String(next.i);
      const existing = currentById.get(id);
      if (existing) {
        Object.assign(existing, next);
        nextRefs.push(existing);
      } else {
        nextRefs.push({ ...next });
      }
    }
    layoutModel.value = nextRefs;
  };

  const flushPendingLayoutUpdate = () => {
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (!pendingLayoutModel) return;
    const layout = pendingLayoutModel;
    pendingLayoutModel = null;
    applyLayoutModelUpdate(layout);
  };

  const scheduleLayoutModelUpdate = (nextLayout: T[]) => {
    pendingLayoutModel = nextLayout;
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      if (!pendingLayoutModel) return;
      const layout = pendingLayoutModel;
      pendingLayoutModel = null;
      applyLayoutModelUpdate(layout);
    });
  };

  onBeforeUnmount(() => {
    flushPendingLayoutUpdate();
  });

  return {
    scheduleLayoutModelUpdate,
    flushPendingLayoutUpdate,
  };
}
