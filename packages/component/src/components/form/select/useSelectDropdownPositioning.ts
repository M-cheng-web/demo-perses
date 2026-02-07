import { computed, nextTick, ref, type Ref } from 'vue';
import { useFloatingOverlay } from '../../../composables/useFloatingOverlay';
import { clampNumber } from './selectLogic';

interface UseSelectDropdownPositioningOptions {
  openRef: Ref<boolean>;
  rootRef: Ref<HTMLElement | undefined>;
  controlRef: Ref<HTMLElement | undefined>;
  dropdownRef: Ref<HTMLElement | undefined>;
  close: () => void;
}

export function useSelectDropdownPositioning(options: UseSelectDropdownPositioningOptions) {
  const dropdownStyle = ref<Record<string, string>>({});

  const syncDropdownPosition = async () => {
    if (typeof window === 'undefined') return;

    const trigger = options.controlRef.value ?? options.rootRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();

    await nextTick();

    const menu = options.dropdownRef.value;
    const menuWidth = menu?.offsetWidth || rect.width;
    const menuHeight = menu?.offsetHeight || 0;
    const padding = 4;

    let left = rect.left;
    let top = rect.bottom + 4;

    left = clampNumber(left, padding, window.innerWidth - menuWidth - padding);

    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - 4;
      if (top < padding) top = padding;
    }

    dropdownStyle.value = {
      minWidth: `${rect.width}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const floatingTriggerRef = computed(() => options.controlRef.value ?? options.rootRef.value);
  const { scheduleUpdatePosition: scheduleSyncDropdownPosition } = useFloatingOverlay({
    openRef: options.openRef,
    triggerRef: floatingTriggerRef,
    overlayRef: options.dropdownRef,
    close: options.close,
    updatePosition: syncDropdownPosition,
    enableScrollSync: true,
    ignoreOverlayOnOutside: false,
  });

  return {
    dropdownStyle,
    syncDropdownPosition,
    scheduleSyncDropdownPosition,
  };
}
