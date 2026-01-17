<!-- 组件说明：抽屉侧边栏，支持左右方向、遮罩关闭与 ESC 关闭 -->
<template>
  <Teleport to="body">
    <div v-if="isRendered" :class="bem()" v-bind="$attrs">
      <div v-if="props.mask" :class="[bem('mask'), { 'is-visible': isMaskVisible }]" @click="handleMaskClick"></div>
      <div :class="[bem('panel'), bem('panel', props.placement), { 'is-visible': isPanelVisible }]" :style="panelStyle">
        <div :class="bem('header')">
          <div :class="bem('title')">{{ title }}</div>
          <button :class="bem('close')" type="button" @click="handleClose">×</button>
        </div>
        <div :class="bem('body')">
          <slot></slot>
        </div>
        <div v-if="showFooter" :class="bem('footer')">
          <slot name="footer">
            <Button type="ghost" @click="handleClose">关闭</Button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
  import { createNamespace, createTimeout, lockBodyScroll, unlockBodyScroll, type TimeoutHandle } from '../../utils';
  import Button from '../base/Button.vue';

  defineOptions({ name: 'GfDrawer', inheritAttrs: false });

  const MASK_TRANSITION_MS = 180;
  const PANEL_TRANSITION_MS = 280;
  const PANEL_OPEN_DELAY_MS = 60;

  const props = withDefaults(
    defineProps<{
      /** 是否显示 */
      open?: boolean;
      /** 抽屉标题 */
      title?: string;
      /** 宽度 */
      width?: number | string;
      /** 是否显示遮罩 */
      mask?: boolean;
      /** 点击遮罩是否可关闭 */
      maskClosable?: boolean;
      /** 是否显示底部区域 */
      footer?: boolean;
      /** 出现方向 */
      placement?: 'right' | 'left';
      /** 是否支持 ESC 关闭 */
      keyboard?: boolean;
    }>(),
    {
      open: false,
      title: '',
      width: 520,
      mask: true,
      maskClosable: true,
      footer: true,
      placement: 'right',
      keyboard: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'close'): void;
  }>();

  const [_, bem] = createNamespace('drawer');

  const isRendered = ref(false);
  const isMaskVisible = ref(false);
  const isPanelVisible = ref(false);
  const timeouts: TimeoutHandle[] = [];
  let rafId: number | null = null;
  let isFirstSync = true;

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
      const delay = props.mask ? PANEL_OPEN_DELAY_MS : 0;
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

  const handleEsc = (event: KeyboardEvent) => {
    if (!props.keyboard) return;
    if (event.key === 'Escape' && props.open) {
      handleClose();
    }
  };

  watch(
    () => props.open,
    async (val) => {
      if (val) {
        window.addEventListener('keydown', handleEsc);
        lockBodyScroll();
        if (isFirstSync) {
          isRendered.value = true;
          isMaskVisible.value = !!props.mask;
          isPanelVisible.value = true;
        } else {
          await openWithAnimation();
        }
      } else {
        window.removeEventListener('keydown', handleEsc);
        unlockBodyScroll();
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

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEsc);
    if (props.open) unlockBodyScroll();
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
</script>

<style scoped lang="less">
  .gf-drawer {
    position: fixed;
    inset: 0;
    z-index: var(--gf-z-drawer);
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
