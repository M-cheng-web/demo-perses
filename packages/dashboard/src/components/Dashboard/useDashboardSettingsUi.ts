import { computed, nextTick, onMounted, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue';

type ToolbarRefLike = Ref<{
  resetSidebarDraft?: () => void;
  applySidebarDraft?: () => void;
} | null>;

interface Options {
  instanceId: ComputedRef<string>;
  rootEl: Ref<HTMLElement | null>;
  settingsEl: Ref<HTMLElement | null>;
  isBooting: ComputedRef<boolean>;
  toolbarRef: ToolbarRefLike;
}

export function useDashboardSettingsUi(options: Options) {
  const settingsOpen = ref(false);

  const SETTINGS_POS_KEY_PREFIX = 'gf-dashboard-settings-pos:';
  const settingsPos = ref<{ x: number; y: number } | null>(null);
  const isSettingsDragging = ref(false);
  const suppressSettingsClick = ref(false);
  let settingsDragPointerId: number | null = null;
  let settingsDragMoved = false;
  let settingsDragStartClientX = 0;
  let settingsDragStartClientY = 0;
  let settingsDragStartX = 0;
  let settingsDragStartY = 0;

  const settingsStorageKey = computed(() => `${SETTINGS_POS_KEY_PREFIX}${options.instanceId.value}`);

  // “半隐藏”交互：
  // - 默认位置（未被拖动/未持久化）半隐藏在右侧
  // - 用户拖动后，如果贴到右侧边缘，也自动半隐藏（减少遮挡内容）
  const SETTINGS_PEEK_EDGE_PX = 10;
  const SETTINGS_SNAP_EDGE_PX = 10;
  const SETTINGS_BUTTON_FALLBACK_SIZE = 44;

  const getSettingsButtonSize = (): { w: number; h: number } => {
    const rect = options.settingsEl.value?.getBoundingClientRect();
    const w = rect?.width ?? SETTINGS_BUTTON_FALLBACK_SIZE;
    const h = rect?.height ?? SETTINGS_BUTTON_FALLBACK_SIZE;
    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  };

  const clampSettingsPos = (pos: { x: number; y: number }): { x: number; y: number } => {
    const root = options.rootEl.value;
    if (!root) return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
    const { w, h } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    const maxY = Math.max(0, Math.floor(root.clientHeight - h));
    const x = Math.min(maxX, Math.max(0, Math.floor(pos.x)));
    const y = Math.min(maxY, Math.max(0, Math.floor(pos.y)));
    return { x, y };
  };

  const clampSettingsPosInPlace = () => {
    if (!settingsPos.value) return;
    settingsPos.value = clampSettingsPos(settingsPos.value);
  };

  const isSettingsNearRightEdge = (pos: { x: number; y: number }): boolean => {
    const root = options.rootEl.value;
    if (!root) return false;
    const { w } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    // maxX=0 表示容器太窄/按钮太宽：此时不做“半隐藏”（避免按钮完全不可见）
    if (maxX <= 0) return false;
    const x = Math.floor(Number(pos.x ?? 0));
    return x >= maxX - SETTINGS_PEEK_EDGE_PX;
  };

  const isSettingsPeek = computed(() => {
    if (isSettingsDragging.value) return false;
    // 未被拖动/未持久化：默认半隐藏在右侧
    if (!settingsPos.value) return true;
    // 已拖动：贴到右侧也半隐藏
    return isSettingsNearRightEdge(settingsPos.value);
  });

  const snapSettingsPos = (pos: { x: number; y: number }): { x: number; y: number } => {
    const root = options.rootEl.value;
    if (!root) return clampSettingsPos(pos);
    const clamped = clampSettingsPos(pos);
    const { w } = getSettingsButtonSize();
    const maxX = Math.max(0, Math.floor(root.clientWidth - w));
    if (maxX > 0 && clamped.x >= maxX - SETTINGS_SNAP_EDGE_PX) {
      return { x: maxX, y: clamped.y };
    }
    return clamped;
  };

  const loadSettingsPos = () => {
    try {
      const raw = localStorage.getItem(settingsStorageKey.value);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      settingsPos.value = clampSettingsPos({ x, y });
    } catch {
      // 忽略：localStorage 不可用/超额等不应影响主流程
    }
  };

  const saveSettingsPos = () => {
    try {
      if (!settingsPos.value) return;
      localStorage.setItem(settingsStorageKey.value, JSON.stringify(settingsPos.value));
    } catch {
      // 忽略：localStorage 不可用/超额等不应影响主流程
    }
  };

  const settingsStyle = computed(() => {
    if (!settingsPos.value) return undefined;
    return {
      left: `${settingsPos.value.x}px`,
      top: `${settingsPos.value.y}px`,
      right: 'auto',
    } as Record<string, string>;
  });

  const openSettings = () => {
    if (options.isBooting.value) return;
    settingsOpen.value = true;
  };

  const closeSettings = () => {
    settingsOpen.value = false;
  };

  const toggleSettings = () => {
    if (options.isBooting.value) return;
    settingsOpen.value = !settingsOpen.value;
  };

  const handleSettingsCancel = () => {
    options.toolbarRef.value?.resetSidebarDraft?.();
  };

  const handleSettingsConfirm = () => {
    options.toolbarRef.value?.applySidebarDraft?.();
  };

  watch(
    () => settingsOpen.value,
    async (open) => {
      if (!open) return;
      await nextTick();
      options.toolbarRef.value?.resetSidebarDraft?.();
    }
  );

  const handleSettingsClick = () => {
    if (suppressSettingsClick.value) {
      suppressSettingsClick.value = false;
      return;
    }
    openSettings();
  };

  const getCurrentSettingsPosFromDom = (): { x: number; y: number } => {
    const root = options.rootEl.value;
    const el = options.settingsEl.value;
    if (!root || !el) return { x: 0, y: 0 };
    const rootRect = root.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return clampSettingsPos({ x: elRect.left - rootRect.left, y: elRect.top - rootRect.top });
  };

  const endSettingsDrag = () => {
    window.removeEventListener('pointermove', handleSettingsPointerMove);
    window.removeEventListener('pointerup', handleSettingsPointerUp);
    window.removeEventListener('pointercancel', handleSettingsPointerUp);
    isSettingsDragging.value = false;
    settingsDragPointerId = null;
  };

  const handleSettingsPointerDown = (event: PointerEvent) => {
    if (options.isBooting.value) return;
    if (settingsDragPointerId != null) return;
    settingsDragPointerId = event.pointerId;
    settingsDragMoved = false;
    suppressSettingsClick.value = false;

    const initial = settingsPos.value ?? getCurrentSettingsPosFromDom();
    settingsPos.value = initial;
    settingsDragStartX = initial.x;
    settingsDragStartY = initial.y;
    settingsDragStartClientX = event.clientX;
    settingsDragStartClientY = event.clientY;
    isSettingsDragging.value = true;

    window.addEventListener('pointermove', handleSettingsPointerMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener('pointerup', handleSettingsPointerUp, { passive: true } as AddEventListenerOptions);
    window.addEventListener('pointercancel', handleSettingsPointerUp, { passive: true } as AddEventListenerOptions);

    try {
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // 忽略：部分浏览器/节点可能不支持 setPointerCapture
    }
  };

  const handleSettingsPointerMove = (event: PointerEvent) => {
    if (settingsDragPointerId == null) return;
    if (event.pointerId !== settingsDragPointerId) return;
    const dx = event.clientX - settingsDragStartClientX;
    const dy = event.clientY - settingsDragStartClientY;
    if (!settingsDragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) settingsDragMoved = true;
    if (!settingsDragMoved) return;
    event.preventDefault();
    settingsPos.value = clampSettingsPos({ x: settingsDragStartX + dx, y: settingsDragStartY + dy });
  };

  const handleSettingsPointerUp = (event: PointerEvent) => {
    if (settingsDragPointerId == null) return;
    if (event.pointerId !== settingsDragPointerId) return;

    if (settingsDragMoved) {
      suppressSettingsClick.value = true;
      if (settingsPos.value) settingsPos.value = snapSettingsPos(settingsPos.value);
      saveSettingsPos();
    }
    endSettingsDrag();
  };

  onMounted(async () => {
    // 延后一帧：确保 root/host 尺寸已稳定（便于恢复并 clamp 拖拽位置）
    await nextTick();
    loadSettingsPos();
    clampSettingsPosInPlace();
  });

  onUnmounted(() => {
    // In case the component is unmounted while dragging, ensure global listeners are removed.
    endSettingsDrag();
  });

  return {
    settingsOpen,
    settingsStyle,
    isSettingsDragging,
    isSettingsPeek,
    clampSettingsPosInPlace,
    openSettings,
    closeSettings,
    toggleSettings,
    handleSettingsCancel,
    handleSettingsConfirm,
    handleSettingsClick,
    handleSettingsPointerDown,
  };
}
