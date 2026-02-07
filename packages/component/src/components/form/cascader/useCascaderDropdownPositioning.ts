import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useFloatingOverlay } from '../../../composables/useFloatingOverlay';
import { placeDropdown, resolveDropdownMetrics, type RectLike } from './cascaderLogic';

type BoolLike = Ref<boolean> | ComputedRef<boolean>;
type ElementLike = Ref<HTMLElement | undefined> | ComputedRef<HTMLElement | undefined>;

interface UseCascaderDropdownPositioningOptions {
  openRef: BoolLike;
  rootRef: ElementLike;
  triggerRef: ElementLike;
  dropdownRef: ElementLike;
  close: () => void;
  getColumnCount: () => number;
  dropdownMinWidth?: () => number | undefined;
  dropdownMaxWidth?: () => number | undefined;
}

const MENU_COLUMN_WIDTH = 168;
const VIEWPORT_PADDING = 8;
const DROPDOWN_OFFSET = 6;

function readViewport() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  return {
    width: w > 0 ? w : 1024,
    height: h > 0 ? h : 768,
  };
}

function toRectLike(rect: DOMRect): RectLike {
  return {
    left: rect.left,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
  };
}

export function useCascaderDropdownPositioning(options: UseCascaderDropdownPositioningOptions) {
  const dropdownStyle = ref<Record<string, string>>({});

  const computeDropdownStyle = (rect: DOMRect, columnCount: number, menuHeight: number) => {
    const viewport = readViewport();
    const { minWidth, maxWidth, menuWidth } = resolveDropdownMetrics({
      viewportWidth: viewport.width,
      columnCount,
      menuColumnWidth: MENU_COLUMN_WIDTH,
      viewportPadding: VIEWPORT_PADDING,
      dropdownMinWidth: options.dropdownMinWidth?.(),
      dropdownMaxWidth: options.dropdownMaxWidth?.(),
    });

    const { left, top } = placeDropdown({
      rect: toRectLike(rect),
      menuWidth,
      menuHeight,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      viewportPadding: VIEWPORT_PADDING,
      dropdownOffset: DROPDOWN_OFFSET,
    });

    dropdownStyle.value = {
      width: `${menuWidth}px`,
      minWidth: `${minWidth}px`,
      maxWidth: `${maxWidth}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const primeDropdownPosition = () => {
    const trigger = options.triggerRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    computeDropdownStyle(rect, 1, 0);
  };

  const syncDropdownPosition = async () => {
    const trigger = options.triggerRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = options.dropdownRef.value;
    const menuHeight = menu?.offsetHeight || 0;
    computeDropdownStyle(rect, options.getColumnCount(), menuHeight);
  };

  const floatingTriggerRef = computed(() => options.triggerRef.value ?? options.rootRef.value);
  const { scheduleUpdatePosition: scheduleSyncDropdownPosition } = useFloatingOverlay({
    openRef: options.openRef,
    triggerRef: floatingTriggerRef,
    overlayRef: computed(() => options.dropdownRef.value),
    close: options.close,
    updatePosition: syncDropdownPosition,
    enableScrollSync: true,
    ignoreOverlayOnOutside: false,
  });

  return {
    dropdownStyle,
    primeDropdownPosition,
    syncDropdownPosition,
    scheduleSyncDropdownPosition,
  };
}
