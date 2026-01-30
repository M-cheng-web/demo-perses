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
    ref="rootRef"
    :class="[bem(), { 'is-open': isOpen }]"
    :style="rootStyle"
    @wheel.stop
    @touchmove.stop
    @transitionend="handleHeaderTransitionEnd"
  >
    <div :class="bem('mask')" @click="requestClose" />

    <div :class="bem('surface')">
      <Panel
        :title="title"
        :description="description"
        size="large"
        :collapsible="!isBooting"
        :collapsed="false"
        :bordered="false"
        :ghost="true"
        :hoverable="false"
        :body-padding="false"
        @update:collapsed="handlePanelHeaderToggle"
      >
        <template #right>
          <PanelGroupRightActions
            v-if="isEditMode && group && !isBooting"
            :group="group"
            :index="groupIndex"
            :is-last="isLast"
            @edit="(g) => emit('edit-group', g)"
          />
        </template>

        <div v-if="showContent && pagedGroup" :class="bem('body')">
          <GridLayout
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
            @update:pageSize="handleUpdatePageSize"
          />
        </div>
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { Pagination, Panel } from '@grafana-fast/component';
  import type { PanelGroup } from '@grafana-fast/types';
  import type { PagedPanelGroup } from '/#/composables/usePanelGroupPagination';
  import { createNamespace } from '/#/utils';
  import GridLayout from '/#/components/GridLayout/GridLayout.vue';
  import PanelGroupRightActions from './PanelGroupRightActions.vue';

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
    /** 编辑/boot 状态 */
    isEditMode: boolean;
    isBooting: boolean;
    /** 面板组排序信息（用于 right actions） */
    groupIndex: number;
    isLast: boolean;
    /** 分页控制（由外部 composable 持有 state） */
    setCurrentPage: (groupId: PanelGroup['id'], page: number) => void;
    setPageSize: (groupId: PanelGroup['id'], pageSize: number) => void;
  }>();

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'after-close'): void;
    (e: 'edit-group', group: PanelGroup): void;
  }>();

  const rootRef = ref<HTMLElement | null>(null);

  const group = computed(() => props.pagedGroup?.group ?? null);
  const title = computed(() => group.value?.title || '未命名面板组');
  const description = computed(() => group.value?.description || '');

  const isActive = ref(false);
  const isOpen = ref(false);
  const isClosing = ref(false);
  const showContent = ref(false);
  let motionSeq = 0;
  let openFallbackTimer: number | null = null;
  let closeFallbackTimer: number | null = null;

  const NEAR_TOP_EPS_PX = 2;

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

  const rootStyle = computed(() => ({
    '--dp-focus-start-y': `${startOffsetY.value}px`,
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

  const openSequence = async () => {
    if (!props.pagedGroup) return;
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
    // 下一帧再切换到 open，触发 CSS transition（避免 mount 即到达终态导致无动画）
    requestAnimationFrame(() => {
      if (seq !== motionSeq) return;
      if (!props.open) return;
      isOpen.value = true;
    });

    // 兜底：如果 transform 没有触发 transitionend（例如 startOffsetY=0 / reduced motion），仍需展示内容
    openFallbackTimer = window.setTimeout(() => {
      if (seq !== motionSeq) return;
      if (!props.open) return;
      showContent.value = true;
    }, 260);
  };

  const closeSequence = () => {
    if (!isActive.value) return;
    const seq = ++motionSeq;
    clearFallbackTimers();
    isClosing.value = true;
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
    }, 280);
  };

  const handleHeaderTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName !== 'transform') return;
    // 仅关心 Panel header 自己的 transform 过渡（避免子元素触发）
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.classList.contains('gf-panel__header')) return;

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
    showContent.value = true;
  };

  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (!isActive.value) return;
    requestClose();
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

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown, { passive: true } as AddEventListenerOptions);
  });

  onBeforeUnmount(() => {
    clearFallbackTimers();
    window.removeEventListener('keydown', handleGlobalKeydown);
  });
</script>

<style scoped lang="less">
  .dp-panel-group-focus-layer {
    position: absolute;
    inset: 0;
    z-index: 140;
    pointer-events: auto;

    &__mask {
      position: absolute;
      inset: 0;
      // 聚焦层背景必须是“不透”的：避免看到底层面板组列表（标题叠印/抖动感）
      background: var(--gf-color-surface);
    }

    &__surface {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    // 让聚焦层里的 header 与列表 header 保持一致（复用同一个 Panel 组件）
    :deep(.gf-panel) {
      height: 100%;
      max-width: 100%;
    }

    // 覆盖 ghost panel 默认 overflow: visible（聚焦层需要固定高度 + 内部滚动）
    :deep(.gf-panel.is-ghost) {
      overflow: hidden;
    }

    // 聚焦层 header 与列表一致：透明背景 + 轻分割线
    :deep(.gf-panel.is-ghost > .gf-panel__header) {
      background: transparent;
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    // 只移动 header（营造“标题浮起”的连续感），内容在动画完成后再展示
    :deep(.gf-panel__header) {
      transform: translateY(var(--dp-focus-start-y, 0px));
      transition: transform var(--gf-motion-normal) var(--gf-easing);
    }

    // 让 body 成为 column，以便 pagination 固定在底部
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

    &__pagination {
      flex: 0 0 auto;
      display: flex;
      justify-content: flex-end;
      padding: 0;
      background: color-mix(in srgb, var(--gf-color-surface), transparent 16%);
      border-top: 1px solid var(--gf-color-border-muted);
    }

    &.is-open {
      :deep(.gf-panel__header) {
        transform: translateY(0px);
      }
    }
  }
</style>
