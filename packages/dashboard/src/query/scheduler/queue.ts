import type { RefreshTask } from './types';

/**
 * 从 pending 任务中选出下一个执行项：
 * 1) 优先级高优先
 * 2) 同优先级下按入队时间 FIFO
 */
export function pickNextTask(pending: Map<string, RefreshTask>): RefreshTask | null {
  let best: RefreshTask | null = null;
  for (const task of pending.values()) {
    if (!best) {
      best = task;
      continue;
    }
    if (task.priority !== best.priority) {
      if (task.priority > best.priority) best = task;
      continue;
    }
    if (task.enqueuedAt < best.enqueuedAt) best = task;
  }
  return best;
}
