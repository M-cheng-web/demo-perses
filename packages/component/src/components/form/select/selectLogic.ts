/**
 * Select 逻辑工具：禁用项跳过、activeIndex 移动、tag 宽度估算等基础函数。
 */
export interface SelectOptionLike {
  disabled?: boolean;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function findFirstEnabledIndex<Option extends SelectOptionLike>(options: Option[]): number {
  const idx = options.findIndex((o) => !o.disabled);
  return Math.max(0, idx);
}

export function moveActiveIndex<Option extends SelectOptionLike>(options: Option[], currentIndex: number, direction: 1 | -1): number {
  if (options.length === 0) return 0;

  let idx = currentIndex;
  for (let i = 0; i < options.length; i++) {
    idx = idx + direction;
    if (idx < 0) idx = options.length - 1;
    if (idx >= options.length) idx = 0;
    if (!options[idx]?.disabled) break;
  }
  return idx;
}

export function estimateTagWidthFromText(text: string): number {
  const t = String(text ?? '').trim();
  const perChar = 7;
  const base = 34;
  const estimated = t.length * perChar + base;
  return clampNumber(estimated, 36, 260);
}
