export interface ViewportDiff {
  addedRender: Set<string>;
  removedRender: Set<string>;
  addedActive: Set<string>;
  removedActive: Set<string>;
}

export function recomputeUnion(source: Map<string, Set<string>>): Set<string> {
  const next = new Set<string>();
  for (const set of source.values()) {
    for (const id of set) next.add(id);
  }
  return next;
}

export function computeViewportDiff(
  prevRender: Set<string>,
  prevActive: Set<string>,
  nextRender: Set<string>,
  nextActive: Set<string>
): ViewportDiff {
  const addedRender = new Set<string>();
  const removedRender = new Set<string>();
  const addedActive = new Set<string>();
  const removedActive = new Set<string>();

  for (const id of nextRender) {
    if (!prevRender.has(id)) addedRender.add(id);
  }
  for (const id of prevRender) {
    if (!nextRender.has(id)) removedRender.add(id);
  }

  for (const id of nextActive) {
    if (!prevActive.has(id)) addedActive.add(id);
  }
  for (const id of prevActive) {
    if (!nextActive.has(id)) removedActive.add(id);
  }

  return {
    addedRender,
    removedRender,
    addedActive,
    removedActive,
  };
}
