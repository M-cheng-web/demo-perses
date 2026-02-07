export interface PinnedCacheSnapshot {
  current: Set<string>;
  queue: string[];
}

export function computeNextPinnedCache(snapshot: PinnedCacheSnapshot, hotIds: string[], keepAliveCount: number): PinnedCacheSnapshot {
  const requestedMaxKeep = Math.max(0, Math.floor(keepAliveCount));
  if (requestedMaxKeep <= 0) {
    return {
      current: new Set<string>(),
      queue: [],
    };
  }

  const hotSet = new Set(hotIds);
  // 如果 hot 数量本身就超过 keepAliveCount，则不能强行缩到 keepAliveCount，
  // 否则会出现一直尝试删除 hot 元素而无法减少 size 的死循环。
  const maxKeep = Math.max(requestedMaxKeep, hotSet.size);

  const current = new Set(snapshot.current);
  const queue = [...snapshot.queue];

  for (const id of hotIds) {
    if (!current.has(id)) {
      current.add(id);
      queue.push(id);
    }
  }

  while (current.size > maxKeep && queue.length > 0) {
    const oldest = queue.shift();
    if (!oldest) continue;
    // 当前仍在 hot 的不移除（优先保证可视范围稳定）
    if (hotSet.has(oldest)) {
      queue.push(oldest);
      continue;
    }
    current.delete(oldest);
  }

  return {
    current,
    queue,
  };
}
