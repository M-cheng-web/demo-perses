import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import type { Pinia } from 'pinia';
import type { Dashboard, Panel, PanelGroup, PanelLayout, ID, TimeRange } from '@grafana-fast/types';
import { useDashboardStore, useTimeRangeStore, useTooltipStore, type MousePosition, type TooltipData } from '@grafana-fast/component';

export interface DashboardSdkOptions {
  /** 指定加载的 dashboard id，默认加载 default */
  dashboardId?: string;
  /** 可选 pinia 实例，默认取当前 active pinia 或自动创建 */
  pinia?: Pinia;
  /** 是否自动加载 dashboard 数据，默认为 true */
  autoLoad?: boolean;
}

export interface DashboardSdkState {
  dashboard: Dashboard | null;
  panelGroups: PanelGroup[];
  isEditMode: boolean;
  viewPanel: Panel | null;
  timeRange: TimeRange;
  tooltip: TooltipData | null;
  mousePosition: MousePosition | null;
}

function ensurePinia(pinia?: Pinia) {
  if (pinia) {
    setActivePinia(pinia);
    return pinia;
  }

  const active = getActivePinia();
  if (active) return active;

  const created = createPinia();
  setActivePinia(created);
  return created;
}

export function useDashboardSdk(targetRef: Ref<HTMLElement | null>, options: DashboardSdkOptions = {}) {
  const pinia = ensurePinia(options.pinia);
  const dashboardStore = useDashboardStore(pinia);
  const timeRangeStore = useTimeRangeStore(pinia);
  const tooltipStore = useTooltipStore(pinia);

  const containerSize = ref({ width: 0, height: 0 });
  const ready = ref(false);

  const updateSize = () => {
    const el = targetRef.value;
    if (!el) return;
    containerSize.value = {
      width: el.clientWidth,
      height: el.clientHeight,
    };
  };

  let resizeObserver: ResizeObserver | null = null;

  const handleMouseMove = (event: MouseEvent) => {
    tooltipStore.updateGlobalMousePosition({
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  };

  watch(
    targetRef,
    (el, prevEl, onCleanup) => {
      prevEl?.removeEventListener('mousemove', handleMouseMove);
      if (resizeObserver && prevEl) {
        resizeObserver.unobserve(prevEl);
      }

      if (el) {
        el.addEventListener('mousemove', handleMouseMove, { passive: true });
        resizeObserver?.observe(el);
        updateSize();
      }

      onCleanup(() => {
        el?.removeEventListener('mousemove', handleMouseMove);
        if (resizeObserver && el) resizeObserver.unobserve(el);
      });
    },
    { immediate: true }
  );

  onMounted(async () => {
    resizeObserver = new ResizeObserver(updateSize);
    if (targetRef.value) {
      resizeObserver.observe(targetRef.value);
      updateSize();
    }

    if (options.autoLoad !== false && !dashboardStore.currentDashboard) {
      await dashboardStore.loadDashboard(options.dashboardId ?? 'default');
    }

    ready.value = true;
  });

  onUnmounted(() => {
    const el = targetRef.value;
    el?.removeEventListener('mousemove', handleMouseMove);
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  const state = computed<DashboardSdkState>(() => ({
    dashboard: dashboardStore.currentDashboard,
    panelGroups: dashboardStore.panelGroups,
    isEditMode: dashboardStore.isEditMode,
    viewPanel: dashboardStore.viewPanel,
    timeRange: timeRangeStore.timeRange,
    tooltip: tooltipStore.currentTooltipData,
    mousePosition: tooltipStore.currentPosition,
  }));

  const actions = {
    loadDashboard: (id: ID) => dashboardStore.loadDashboard(id),
    saveDashboard: () => dashboardStore.saveDashboard(),
    toggleEditMode: () => dashboardStore.toggleEditMode(),
    addPanelGroup: (group: Partial<PanelGroup>) => dashboardStore.addPanelGroup(group),
    updatePanelGroup: (id: ID, updates: Partial<PanelGroup>) => dashboardStore.updatePanelGroup(id, updates),
    deletePanelGroup: (id: ID) => dashboardStore.deletePanelGroup(id),
    updatePanelGroupLayout: (groupId: ID, layout: PanelLayout[]) => dashboardStore.updatePanelGroupLayout(groupId, layout),
    duplicatePanel: (groupId: ID, panelId: ID) => dashboardStore.duplicatePanel(groupId, panelId),
    togglePanelView: (groupId: ID, panelId: ID) => dashboardStore.togglePanelView(groupId, panelId),
    getPanelGroupById: (id: ID) => dashboardStore.getPanelGroupById(id),
    getPanelById: (groupId: ID, panelId: ID) => dashboardStore.getPanelById(groupId, panelId),
    setTimeRange: (range: TimeRange) => timeRangeStore.setTimeRange(range),
    setRefreshInterval: (interval: number) => timeRangeStore.setRefreshInterval(interval),
    refreshTimeRange: () => timeRangeStore.refresh(),
    registerChart: tooltipStore.registerChart,
    updateChartRegistration: tooltipStore.updateChartRegistration,
    unregisterChart: tooltipStore.unregisterChart,
    setGlobalMousePosition: tooltipStore.updateGlobalMousePosition,
  };

  return {
    pinia,
    ready,
    targetRef,
    containerSize,
    state,
    dashboardStore,
    timeRangeStore,
    tooltipStore,
    actions,
  };
}
