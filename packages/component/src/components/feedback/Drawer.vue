<!-- 组件说明：抽屉侧边栏，支持左右方向与遮罩关闭 -->
<template>
  <Teleport :to="portalTarget">
    <div v-if="isRendered" :class="[bem(), themeClass]" :data-gf-theme="colorScheme" v-bind="$attrs">
      <div v-if="props.mask" :class="[bem('mask'), { 'is-visible': isMaskVisible }]" @click="handleMaskClick"></div>
      <div :class="[bem('panel'), bem('panel', props.placement), { 'is-visible': isPanelVisible }]" :style="panelStyle">
        <div :class="bem('header', { center: props.titleAlign === 'center' })">
          <div :class="bem('title-wrap')">
            <div :class="bem('title')">{{ title }}</div>
            <div v-if="props.subtitle" :class="bem('subtitle')">{{ props.subtitle }}</div>
          </div>
          <button :class="bem('close')" type="button" @click="handleClose">×</button>
        </div>
        <div :class="bem('body')">
          <slot></slot>
        </div>
        <div v-if="showFooter" :class="bem('footer')">
          <slot name="footer">
            <template v-if="props.confirmable">
              <Button type="ghost" @click="handleCancel">{{ props.cancelText }}</Button>
              <Button type="primary" :loading="props.okLoading" :disabled="props.okDisabled" @click="handleConfirm">
                {{ props.okText }}
              </Button>
            </template>
            <template v-else>
              <Button type="ghost" @click="handleClose">关闭</Button>
            </template>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';
  import { acquireScrollLock, createNamespace, createTimeout, type TimeoutHandle } from '../../utils';
  import Button from '../base/Button.vue';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfDrawer', inheritAttrs: false });

  const MASK_TRANSITION_MS = 180;
  const PANEL_TRANSITION_MS = 280;

  const props = withDefaults(
    defineProps<{
      /** 是否显示 */
      open?: boolean;
      /** 抽屉标题 */
      title?: string;
      /** 抽屉副标题（可选） */
      subtitle?: string;
      /** 标题对齐方式 */
      titleAlign?: 'left' | 'center';
      /** 宽度 */
      width?: number | string;
      /** 是否显示遮罩 */
      mask?: boolean;
      /** 点击遮罩是否可关闭 */
      maskClosable?: boolean;
      /** 是否显示底部区域 */
      footer?: boolean;
      /** 打开时是否锁定滚动（默认 true） */
      lockScroll?: boolean;
      /**
       * 自定义滚动锁目标（用于嵌入式场景）
       * - 不传：锁 body
       * - 传入元素：锁定该元素的滚动（overflow: hidden）
       */
      lockScrollEl?: HTMLElement | null;
      /** 是否显示默认“取消/确定”按钮 */
      confirmable?: boolean;
      /** 确认按钮文案 */
      okText?: string;
      /** 取消按钮文案 */
      cancelText?: string;
      /** 确认按钮 loading */
      okLoading?: boolean;
      /** 确认按钮禁用 */
      okDisabled?: boolean;
      /** 点击确认后是否自动关闭 */
      closeOnConfirm?: boolean;
      /** 点击取消后是否自动关闭 */
      closeOnCancel?: boolean;
      /** 出现方向 */
      placement?: 'right' | 'left';
      /**
       * 打开时的 panel 延迟（ms）
       *
       * 说明：
       * - 过去为了制造“mask 先出现”的层次感，panel 会有一个小延迟
       * - 默认改为 0（mask/panel 同步出现，更接近 AntD 的观感）
       */
      openDelay?: number;
    }>(),
    {
      open: false,
      title: '',
      subtitle: '',
      titleAlign: 'left',
      width: 520,
      mask: true,
      maskClosable: true,
      footer: true,
      lockScroll: true,
      lockScrollEl: null,
      confirmable: false,
      okText: '确定',
      cancelText: '取消',
      okLoading: false,
      okDisabled: false,
      closeOnConfirm: true,
      closeOnCancel: true,
      placement: 'right',
      openDelay: 0,
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'close'): void;
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('drawer');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');

  const isRendered = ref(false);
  const isMaskVisible = ref(false);
  const isPanelVisible = ref(false);
  const timeouts: TimeoutHandle[] = [];
  let rafId: number | null = null;
  let isFirstSync = true;
  let releaseScrollLock: (() => void) | null = null;

  const releaseIfNeeded = () => {
    releaseScrollLock?.();
    releaseScrollLock = null;
  };

  const clearTimers = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    while (timeouts.length) timeouts.pop()?.cancel();
  };

  const openWithAnimation = async () => {
    clearTimers();
    isRendered.value = true;
    isMaskVisible.value = false;
    isPanelVisible.value = false;

    await nextTick();
    rafId = requestAnimationFrame(() => {
      if (props.mask) isMaskVisible.value = true;
      const delay = props.mask ? Math.max(0, Math.floor(Number(props.openDelay ?? 0))) : 0;
      timeouts.push(
        createTimeout(() => {
          isPanelVisible.value = true;
        }, delay)
      );
    });
  };

  const closeWithAnimation = () => {
    clearTimers();
    isPanelVisible.value = false;

    if (props.mask) {
      timeouts.push(
        createTimeout(() => {
          isMaskVisible.value = false;
        }, PANEL_TRANSITION_MS)
      );
      timeouts.push(
        createTimeout(() => {
          isRendered.value = false;
        }, PANEL_TRANSITION_MS + MASK_TRANSITION_MS)
      );
      return;
    }

    timeouts.push(
      createTimeout(() => {
        isRendered.value = false;
      }, PANEL_TRANSITION_MS)
    );
  };

  const panelStyle = computed(() => {
    const w = typeof props.width === 'number' ? `${props.width}px` : props.width;
    const horizontal = props.placement === 'left' ? { left: 0 } : { right: 0 };
    const from = props.placement === 'right' ? '100%' : '-100%';
    return { width: w, maxWidth: '90vw', ...horizontal, '--gf-drawer-slide-from': from };
  });

  const showFooter = computed(() => props.footer !== false);

  watch(
    () => props.open,
    async (val) => {
      if (val) {
        if (props.lockScroll !== false && !releaseScrollLock) releaseScrollLock = acquireScrollLock(props.lockScrollEl ?? null);
        if (isFirstSync) {
          isRendered.value = true;
          isMaskVisible.value = !!props.mask;
          isPanelVisible.value = true;
        } else {
          await openWithAnimation();
        }
      } else {
        releaseIfNeeded();
        if (isFirstSync) {
          isRendered.value = false;
          isMaskVisible.value = false;
          isPanelVisible.value = false;
        } else {
          closeWithAnimation();
        }
      }
      isFirstSync = false;
    },
    { immediate: true }
  );

  watch(
    () => props.lockScrollEl,
    (nextEl) => {
      if (!props.open) return;
      if (props.lockScroll === false) return;
      // switch lock target while staying open
      releaseIfNeeded();
      releaseScrollLock = acquireScrollLock(nextEl ?? null);
    }
  );

  watch(
    () => props.lockScroll,
    (enabled) => {
      if (!props.open) return;
      if (enabled === false) {
        releaseIfNeeded();
        return;
      }
      if (releaseScrollLock) return;
      releaseScrollLock = acquireScrollLock(props.lockScrollEl ?? null);
    }
  );

  onBeforeUnmount(() => {
    releaseIfNeeded();
    clearTimers();
  });

  const handleMaskClick = () => {
    if (!props.maskClosable) return;
    handleClose();
  };

  const handleClose = () => {
    emit('update:open', false);
    emit('close');
  };

  const handleCancel = () => {
    emit('cancel');
    if (props.closeOnCancel !== false) handleClose();
  };

  const handleConfirm = () => {
    emit('confirm');
    if (props.closeOnConfirm !== false) handleClose();
  };
</script>

<style scoped lang="less">
  .gf-drawer {
    position: fixed;
    inset: 0;
    z-index: var(--gf-z-drawer);
    /* Theme containers may set background-color; overlays must stay transparent. */
    background: transparent;
  }

  .gf-drawer__mask {
    position: absolute;
    inset: 0;
    background: var(--gf-color-mask);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s var(--gf-easing, ease);
  }

  .gf-drawer__mask.is-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .gf-drawer__panel {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--gf-surface);
    border-left: 1px solid var(--gf-border);
    box-shadow: var(--gf-shadow-2);
    display: flex;
    flex-direction: column;
    will-change: transform, opacity;
    transform: translateX(var(--gf-drawer-slide-from, 100%));
    opacity: 0;
    pointer-events: none;
    transition:
      transform 0.28s var(--gf-easing, ease),
      opacity 0.18s var(--gf-easing, ease);
  }

  .gf-drawer__panel.is-visible {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .gf-drawer__panel--left {
    border-left: none;
    border-right: 1px solid var(--gf-border);
  }

  .gf-drawer__header {
    padding: var(--gf-space-2) var(--gf-space-3);
    border-bottom: 1px solid var(--gf-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .gf-drawer__header--center {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .gf-drawer__header--center .gf-drawer__title-wrap {
    grid-column: 2;
    justify-self: center;
    text-align: center;
  }

  .gf-drawer__header--center .gf-drawer__close {
    grid-column: 3;
    justify-self: end;
  }

  .gf-drawer__title-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
  }

  .gf-drawer__title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.25;
    color: var(--gf-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gf-drawer__subtitle {
    font-size: 12px;
    line-height: 1.4;
    color: var(--gf-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gf-drawer__body {
    flex: 1;
    overflow: auto;
    padding: var(--gf-space-3);
  }

  .gf-drawer__footer {
    padding: var(--gf-space-2) var(--gf-space-3);
    border-top: 1px solid var(--gf-border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    background: var(--gf-color-surface-muted);
  }

  .gf-drawer__close {
    border: none;
    background: transparent;
    color: var(--gf-text-secondary);
    cursor: pointer;
    font-size: 16px;
    padding: 4px 6px;
    border-radius: var(--gf-radius-sm);
    transition: all 0.2s var(--gf-easing);

    &:hover {
      color: var(--gf-primary-strong);
      background: var(--gf-primary-soft);
    }
  }
</style>
