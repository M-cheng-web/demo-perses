export type SortOrder = 'ascend' | 'descend';

export interface SortState {
  key: string;
  order: SortOrder;
}

export function getColumnKey(col: { key?: string; dataIndex?: string }): string {
  return String(col.key || col.dataIndex || '').trim();
}

export function nextSortState(current: SortState | null, key: string): SortState | null {
  const k = String(key ?? '').trim();
  if (!k) return null;
  if (current?.key === k) {
    return current.order === 'ascend' ? { key: k, order: 'descend' } : null;
  }
  return { key: k, order: 'ascend' };
}
