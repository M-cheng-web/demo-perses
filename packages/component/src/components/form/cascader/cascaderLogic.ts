export interface CascaderOptionLike {
  label: string;
  value: unknown;
  children?: CascaderOptionLike[];
  disabled?: boolean;
}

export interface RectLike {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveCascaderPath<Option extends CascaderOptionLike>(options: Option[], values: unknown[] | undefined): Option[] {
  const pathValues = Array.isArray(values) ? values : [];
  const out: Option[] = [];
  let current = options;
  for (const val of pathValues) {
    const found = current.find((o) => o.value === val);
    if (!found) break;
    out.push(found);
    current = (found.children ?? []) as Option[];
  }
  return out;
}

interface ResolveDropdownMetricsInput {
  viewportWidth: number;
  columnCount: number;
  menuColumnWidth: number;
  viewportPadding: number;
  dropdownMinWidth?: number;
  dropdownMaxWidth?: number;
}

export function resolveDropdownMetrics(input: ResolveDropdownMetricsInput) {
  const viewportMaxWidth = Math.max(220, input.viewportWidth - input.viewportPadding * 2);
  const configMaxWidth = typeof input.dropdownMaxWidth === 'number' ? Math.max(220, input.dropdownMaxWidth) : viewportMaxWidth;
  const maxWidth = Math.min(configMaxWidth, viewportMaxWidth);

  const rawMin = typeof input.dropdownMinWidth === 'number' ? input.dropdownMinWidth : input.menuColumnWidth;
  const minWidth = clampNumber(rawMin, input.menuColumnWidth, maxWidth);

  const menuWidth = clampNumber(input.menuColumnWidth * Math.max(1, input.columnCount), minWidth, maxWidth);

  return {
    minWidth,
    maxWidth,
    menuWidth,
  };
}

interface PlaceDropdownInput {
  rect: RectLike;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportPadding: number;
  dropdownOffset: number;
}

export function placeDropdown(input: PlaceDropdownInput) {
  let left = input.rect.left;
  let top = input.rect.bottom + input.dropdownOffset;

  left = clampNumber(left, input.viewportPadding, input.viewportWidth - input.menuWidth - input.viewportPadding);

  if (top + input.menuHeight > input.viewportHeight - input.viewportPadding) {
    top = input.rect.top - input.menuHeight - input.dropdownOffset;
    if (top < input.viewportPadding) top = input.viewportPadding;
  }

  return {
    left,
    top,
  };
}
