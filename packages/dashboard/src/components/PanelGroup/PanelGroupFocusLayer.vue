<!--
  组件说明：面板组聚焦层（PanelGroupFocusLayer）

  目标：
  - 打开面板组时不改变底层列表的滚动位置（不打乱工作流）
  - 标题从“点击位置”平滑移动到顶部，然后再展示内容
  - 关闭时标题回到原位置，再退出聚焦层
-->
<template>
  <div
    v-show="isActive"
    :class="[bem(), { 'is-open': isOpen }]"
    :style="rootStyle"
    @wheel.stop
    @touchmove.stop
    @transitionend="handleHeaderTransitionEnd"
  >
    <div :class="bem('surface')">
      <Panel
        :class="bem('group-panel')"
        :title="title"
        :description="description"
        size="large"
        :collapsible="!isBooting"
        :collapsed="false"
        :bordered="false"
        :ghost="false"
        :hoverable="false"
        :body-padding="false"
        @update:collapsed="handlePanelHeaderToggle"
      >
        <template #right>
          <div v-if="group && !isBooting" :class="bem('actions')">
            <Button type="text" size="small" :icon="h(ReloadOutlined)" :disabled="isBooting" @click="handleRefresh">刷新</Button>
            <Button v-if="canEditGroup" size="small" :type="isGroupEditing ? 'ghost' : 'primary'" :disabled="isBooting" @click="handleToggleEditing">
              {{ isGroupEditing ? '退出编辑' : '编辑' }}
            </Button>
          </div>
        </template>

        <div :class="bem('body')">
          <GridLayout
            v-if="showContent && pagedGroup"
            :key="pagedGroup.pageKey"
            :group-id="pagedGroup.group.id"
            :panels="pagedGroup.pagePanels"
            :layout="pagedGroup.pageLayout"
            :layout-base-y="pagedGroup.layoutBaseY"
            scroll-mode="self"
            scroll-height="100%"
          />
        </div>

        <div v-if="showContent && pagedGroup && pagedGroup.total > pagerThreshold" :class="bem('pagination')">
          <Pagination
            size="small"
            :current="pagedGroup.currentPage"
            :page-size="pagedGroup.pageSize"
            :page-size-options="pageSizeOptions"
            :total="pagedGroup.total"
            :show-size-changer="true"
            :hide-on-single-page="false"
            :disabled="isBooting"
            @update:current="handleUpdateCurrentPage"
            @update:page-size="handleUpdatePageSize"
          />
        </div>
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, nextTick, onBeforeUnmount, ref, watch } from 'vue';
  import { Button, Pagination, Panel, message } from '@grafana-fast/component';
  import { storeToRefs } from '@grafana-fast/store';
  import { ReloadOutlined } from '@ant-design/icons-vue';
  import type { PanelGroup } from '@grafana-fast/types';
  import type { PagedPanelGroup } from '/#/composables/usePanelGroupPagination';
  import { createNamespace } from '/#/utils';
  import GridLayout from '/#/components/GridLayout/GridLayout.vue';
  import { useDashboardStore, useEditorStore, useTimeRangeStore } from '/#/stores';

  const [_, bem] = createNamespace('panel-group-focus-layer');

  const props = defineProps<{
    /** 是否处于打开态（用于触发开/关动画） */
    open: boolean;
    /** 从列表点击位置计算得到的 offset（相对 dashboard root 顶部） */
    startOffsetY: number;
    /** 当前聚焦的分页组（从外部 pagination composable 派生） */
    pagedGroup: PagedPanelGroup | null;
    /** Pagination options */
    pageSizeOptions: number[];
    pagerThreshold: number;
    /** boot 状态 */
    isBooting: boolean;
    /**
     * 聚焦层 header 动画持续时间（ms）
     *
     * 约定：
     * - header 上移动/下落的动画时长应与该值一致
     * - 面板列表内容会在 opening 动画结束后再渲染（保持连续感）
     */
    motionMs?: number;
    /** 分页控制（由外部 composable 持有 state） */
    setCurrentPage: (groupId: PanelGroup['id'], page: number) => void;
    setPageSize: (groupId: PanelGroup['id'], pageSize: number) => void;
  }>();

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'after-close'): void;
    (e: 'edit-group', group: PanelGroup): void;
  }>();

  const group = computed(() => props.pagedGroup?.group ?? null);
  const title = computed(() => group.value?.title || '未命名面板组');
  const description = computed(() => group.value?.description || '');

  const dashboardStore = useDashboardStore();
  const editorStore = useEditorStore();
  const timeRangeStore = useTimeRangeStore();
  const { isReadOnly } = storeToRefs(dashboardStore);

  const isGroupEditing = computed(() => {
    const g = group.value;
    if (!g) return false;
    return dashboardStore.isGroupEditing(g.id);
  });

  const canEditGroup = computed(() => !props.isBooting && !isReadOnly.value);

  const isActive = ref(false);
  const isOpen = ref(false);
  const isClosing = ref(false);
  const showContent = ref(false);
  let motionSeq = 0;
  let openFallbackTimer: number | null = null;
  let closeFallbackTimer: number | null = null;

  const NEAR_TOP_EPS_PX = 2;
  const DEFAULT_MOTION_MS = 200;

  const clampStartY = (value: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  };

  const clearFallbackTimers = () => {
    if (openFallbackTimer != null) {
      window.clearTimeout(openFallbackTimer);
      openFallbackTimer = null;
    }
    if (closeFallbackTimer != null) {
      window.clearTimeout(closeFallbackTimer);
      closeFallbackTimer = null;
    }
  };

  const startOffsetY = computed(() => {
    const y = clampStartY(props.startOffsetY);
    // 顶部附近（例如 1-2px 的 subpixel/边框差异）不做动画，避免“轻微抖动”
    if (y <= NEAR_TOP_EPS_PX) return 0;
    return y;
  });

  const motionMs = computed(() => {
    const raw = Number(props.motionMs);
    if (!Number.isFinite(raw)) return DEFAULT_MOTION_MS;
    return Math.max(0, Math.floor(raw));
  });

  const rootStyle = computed(() => ({
    '--dp-focus-start-y': `${startOffsetY.value}px`,
    '--dp-focus-motion': `${motionMs.value}ms`,
  }));

  const handlePanelHeaderToggle = () => {
    requestClose();
  };

  const handleUpdateCurrentPage = (page: number) => {
    const g = props.pagedGroup?.group;
    if (!g) return;
    props.setCurrentPage(g.id, page);
  };

  const handleUpdatePageSize = (pageSize: number) => {
    const g = props.pagedGroup?.group;
    if (!g) return;
    props.setPageSize(g.id, pageSize);
  };

  const requestClose = () => {
    emit('update:open', false);
  };

  const handleRefresh = () => {
    if (props.isBooting) return;
    timeRangeStore.refresh();
    message.success('已刷新');
  };

  const handleToggleEditing = () => {
    if (props.isBooting) return;
    if (!canEditGroup.value) return;
    const g = group.value;
    if (!g) return;
    // 退出编辑时：关闭面板编辑器，避免停留在“不可编辑”状态下的编辑 UI
    if (isGroupEditing.value) editorStore.closeEditor();
    dashboardStore.toggleGroupEditing(g.id);
  };

  const openSequence = async () => {
    const seq = ++motionSeq;
    clearFallbackTimers();
    isClosing.value = false;
    showContent.value = false;
    isActive.value = true;
    // 第一个面板组（已在顶部）无需动画：立即展示内容，避免抖动/延迟
    if (startOffsetY.value <= 0) {
      isOpen.value = true;
      showContent.value = true;
      return;
    }

    isOpen.value = false;
    await nextTick();
    // 关键：需要确保“初始状态（未 open）”先 paint 一次，再切换到 open，
    // 否则浏览器会直接以终态渲染，导致没有过渡效果。
    requestAnimationFrame(() => {
      if (seq !== motionSeq) return;
      if (!props.open) return;
      // 下一帧再切换到 open，确保上一帧已 paint 起始 transform
      requestAnimationFrame(() => {
        if (seq !== motionSeq) return;
        if (!props.open) return;
        if (isClosing.value) return;
        isOpen.value = true;

        // 使用固定时长控制内容渲染：保持“标题浮起 -> 动画结束 -> 展开内容”的连续感
        openFallbackTimer = window.setTimeout(() => {
          if (seq !== motionSeq) return;
          if (!props.open) return;
          if (isClosing.value) return;
          showContent.value = true;
        }, motionMs.value);
      });
    });
  };

  const closeSequence = () => {
    if (!isActive.value) return;
    const seq = ++motionSeq;
    clearFallbackTimers();
    isClosing.value = true;
    // 关闭时内容直接消失：只保留 header 下落动画（更符合直觉）
    showContent.value = false;
    if (startOffsetY.value <= 0) {
      isActive.value = false;
      isClosing.value = false;
      isOpen.value = false;
      emit('after-close');
      return;
    }
    isOpen.value = false;

    // 兜底：如果 transform 没有触发 transitionend，仍需退出并通知上层清理状态
    closeFallbackTimer = window.setTimeout(() => {
      if (seq !== motionSeq) return;
      if (props.open) return;
      isActive.value = false;
      isClosing.value = false;
      emit('after-close');
    }, motionMs.value + 20);
  };

  const handleHeaderTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName !== 'transform') return;
    // 仅关心 Panel header 自己的 transform 过渡（避免子元素触发）
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.classList.contains('gf-panel__header')) return;
    // 只处理“聚焦层主 Panel”的 header（避免子面板 header 干扰时序）
    if (!target.closest('.dp-panel-group-focus-layer__group-panel')) return;

    if (isClosing.value) {
      clearFallbackTimers();
      isActive.value = false;
      isClosing.value = false;
      emit('after-close');
      return;
    }

    // opening end
    if (openFallbackTimer != null) {
      window.clearTimeout(openFallbackTimer);
      openFallbackTimer = null;
    }
    // opening end: 内容由 timer 控制；这里仅作为兜底（例如某些浏览器 timer 被 clamp）
    if (showContent.value) return;
    showContent.value = true;
  };

  watch(
    () => props.open,
    (open) => {
      if (open) {
        void openSequence();
      } else {
        closeSequence();
      }
    },
    { immediate: true }
  );

  // 聚焦的组变化：按“重新打开”处理（确保 startOffsetY 与内容正确刷新）
  watch(
    () => props.pagedGroup?.group?.id,
    () => {
      if (!props.open) return;
      void openSequence();
    }
  );

  onBeforeUnmount(() => {
    clearFallbackTimers();
  });
</script>

<style scoped lang="less">
  .dp-panel-group-focus-layer {
    position: absolute;
    inset: 0;
    z-index: 140;
    pointer-events: auto;
    background: var(--gf-color-surface);

    &__surface {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    &__group-panel {
      height: 100%;
      max-width: 100%;
    }

    :deep(.dp-panel-group-focus-layer__group-panel > .gf-panel__header) {
      background: var(--gf-color-surface);
      border-bottom: 1px solid var(--gf-color-border-muted);
      transform: translateY(var(--dp-focus-start-y, 0px));
      transition: transform var(--dp-focus-motion, var(--gf-motion-normal)) var(--gf-easing);
    }

    :deep(.gf-panel__body) {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    &__body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    &__pagination {
      flex: 0 0 auto;
      display: flex;
      justify-content: flex-end;
      padding: 12px 16px;
      background: var(--gf-color-surface-muted);
      border-top: 1px solid var(--gf-color-border-muted);
    }

    &.is-open {
      :deep(.dp-panel-group-focus-layer__group-panel > .gf-panel__header) {
        transform: translateY(0px);
      }
    }
  }
</style>
