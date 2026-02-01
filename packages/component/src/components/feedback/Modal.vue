<!-- 组件说明：模态对话框，支持自定义页眉/页脚、遮罩关闭等 -->
<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="open" :class="[bem(), themeClass]" :data-gf-theme="colorScheme" v-bind="$attrs">
        <div :class="bem('mask')" @click="handleMaskClick"></div>
        <div :class="bem('panel')" :style="panelStyle">
          <div :class="bem('header')">
            <div :class="bem('title')">{{ title }}</div>
            <button :class="bem('close')" type="button" @click="handleCancel">×</button>
          </div>
          <div :class="bem('body')" :style="bodyStyle">
            <slot></slot>
          </div>
          <div v-if="showFooter" :class="bem('footer')">
            <slot name="footer">
              <Button type="ghost" @click="handleCancel">取消</Button>
              <Button type="primary" @click="handleOk">确定</Button>
            </slot>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, inject, onBeforeUnmount, watch } from 'vue';
  import { createNamespace, lockScroll as lockBodyScroll, unlockScroll as unlockBodyScroll } from '../../utils';
  import Button from '../base/Button.vue';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';

  defineOptions({ name: 'GfModal', inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      /** 是否显示 */
      open?: boolean;
      /** 标题文本 */
      title?: string;
      /** 宽度 */
      width?: number | string;
      /** 关闭时是否销毁内容 */
      destroyOnClose?: boolean;
      /** 点击遮罩是否可关闭 */
      maskClosable?: boolean;
      /** 是否显示默认页脚（传 null 隐藏） */
      footer?: boolean | null;
      /** 打开时是否锁定滚动（默认 true） */
      lockScroll?: boolean;
      /**
       * 自定义滚动锁目标（用于嵌入式场景）
       * - 不传：锁 body
       * - 传入元素：锁定该元素的滚动（overflow: hidden）
       */
      lockScrollEl?: HTMLElement | null;
      /** Body 区域样式 */
      bodyStyle?: Record<string, any>;
      /** 是否居中（预留） */
      centered?: boolean;
    }>(),
    {
      open: false,
      title: '',
      width: 640,
      destroyOnClose: false,
      maskClosable: true,
      footer: true,
      lockScroll: true,
      lockScrollEl: null,
      bodyStyle: undefined,
      centered: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'ok'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('modal');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  let lockedScrollEl: HTMLElement | null = null;
  let isScrollLocked = false;

  const panelStyle = computed(() => {
    const w = typeof props.width === 'number' ? `${props.width}px` : props.width;
    return { width: w, maxWidth: '90vw' };
  });

  const showFooter = computed(() => props.footer !== false && props.footer !== null);

  watch(
    () => props.open,
    (val) => {
      if (val) {
        if (props.lockScroll !== false) {
          const el = props.lockScrollEl ?? null;
          lockedScrollEl = el;
          lockBodyScroll(el);
          isScrollLocked = true;
        }
      } else {
        if (props.lockScroll !== false && isScrollLocked) {
          unlockBodyScroll(lockedScrollEl ?? null);
          lockedScrollEl = null;
          isScrollLocked = false;
        }
      }
    },
    { immediate: true }
  );

  watch(
    () => props.lockScrollEl,
    (nextEl) => {
      if (!props.open) return;
      if (props.lockScroll === false) return;
      if (isScrollLocked) unlockBodyScroll(lockedScrollEl ?? null);
      const el = nextEl ?? null;
      lockedScrollEl = el;
      lockBodyScroll(el);
      isScrollLocked = true;
    }
  );

  watch(
    () => props.lockScroll,
    (enabled) => {
      if (!props.open) return;
      if (enabled === false) {
        if (isScrollLocked) unlockBodyScroll(lockedScrollEl ?? null);
        lockedScrollEl = null;
        isScrollLocked = false;
        return;
      }
      if (isScrollLocked) return;
      const el = props.lockScrollEl ?? null;
      lockedScrollEl = el;
      lockBodyScroll(el);
      isScrollLocked = true;
    }
  );

  onBeforeUnmount(() => {
    if (props.open && props.lockScroll !== false && isScrollLocked) unlockBodyScroll(lockedScrollEl ?? null);
  });

  const handleMaskClick = () => {
    if (!props.maskClosable) return;
    handleCancel();
  };

  const handleOk = () => {
    emit('ok');
  };

  const handleCancel = () => {
    emit('update:open', false);
    emit('cancel');
  };
</script>

<style scoped lang="less">
  .gf-modal {
    position: fixed;
    inset: 0;
    z-index: var(--gf-z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--gf-space-4);
    /* Theme containers may set background-color; overlays must stay transparent. */
    background: transparent;
  }

  .gf-modal__mask {
    position: absolute;
    inset: 0;
    background: var(--gf-color-mask);
  }

  .gf-modal__panel {
    position: relative;
    z-index: 1;
    background: var(--gf-surface);
    border: 1px solid var(--gf-border);
    border-radius: var(--gf-radius-lg);
    box-shadow: var(--gf-shadow-2);
    overflow: hidden;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .gf-modal__header {
    padding: var(--gf-space-2) var(--gf-space-3);
    border-bottom: 1px solid var(--gf-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gf-modal__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--gf-text);
  }

  .gf-modal__close {
    border: none;
    background: transparent;
    color: var(--gf-text-secondary);
    cursor: pointer;
    font-size: 16px;
    padding: 4px 6px;
    border-radius: var(--gf-radius-xs);
    transition: all 0.2s var(--gf-easing);

    &:hover {
      color: var(--gf-primary-strong);
      background: var(--gf-primary-soft);
    }
  }

  .gf-modal__body {
    padding: var(--gf-space-3);
    overflow: auto;
  }

  .gf-modal__footer {
    padding: var(--gf-space-2) var(--gf-space-3);
    border-top: 1px solid var(--gf-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    background: var(--gf-color-surface-muted);
  }
</style>
