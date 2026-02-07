<!-- 组件说明：模态对话框，支持自定义页眉/页脚、遮罩关闭等 (AntD-inspired) -->
<template>
  <Teleport :to="portalTarget">
    <Transition name="gf-fade">
      <div v-if="open" :class="[bem('root'), themeClass]" :data-gf-theme="colorScheme" v-bind="$attrs">
        <div :class="bem('mask')" @click="handleMaskClick"></div>
        <Transition name="gf-zoom">
          <div v-if="open" :class="[bem('wrap'), { 'is-centered': centered }]" @click.self="handleMaskClick">
            <div :class="bem('content')" :style="panelStyle">
              <button v-if="closable" :class="bem('close')" type="button" aria-label="Close" @click="handleCancel">
                <CloseOutlined />
              </button>
              <div v-if="title || $slots.title" :class="bem('header')">
                <div :class="bem('title')">
                  <slot name="title">{{ title }}</slot>
                </div>
              </div>
              <div :class="bem('body')" :style="bodyStyle">
                <slot></slot>
              </div>
              <div v-if="showFooter" :class="bem('footer')">
                <slot name="footer">
                  <Button @click="handleCancel">{{ cancelText }}</Button>
                  <Button type="primary" :loading="confirmLoading" @click="handleOk">{{ okText }}</Button>
                </slot>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, inject, onBeforeUnmount, watch } from 'vue';
  import { CloseOutlined } from '@ant-design/icons-vue';
  import { acquireScrollLock, createNamespace } from '../../utils';
  import Button from '../base/Button.vue';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

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
      /** 是否显示右上角关闭按钮 */
      closable?: boolean;
      /** 是否显示默认页脚 */
      footer?: boolean | null;
      /** 确认按钮文字 */
      okText?: string;
      /** 取消按钮文字 */
      cancelText?: string;
      /** 确认按钮 loading 状态 */
      confirmLoading?: boolean;
      /** 打开时是否锁定滚动 */
      lockScroll?: boolean;
      /** 自定义滚动锁目标 */
      lockScrollEl?: HTMLElement | null;
      /** Body 区域样式 */
      bodyStyle?: Record<string, any>;
      /** 是否居中展示 */
      centered?: boolean;
      /** 层级 */
      zIndex?: number;
    }>(),
    {
      open: false,
      title: '',
      width: 520,
      destroyOnClose: false,
      maskClosable: true,
      closable: true,
      footer: true,
      okText: '确定',
      cancelText: '取消',
      confirmLoading: false,
      lockScroll: true,
      lockScrollEl: null,
      bodyStyle: undefined,
      centered: false,
      zIndex: undefined,
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
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  let releaseScrollLock: (() => void) | null = null;

  const releaseIfNeeded = () => {
    releaseScrollLock?.();
    releaseScrollLock = null;
  };

  const panelStyle = computed(() => {
    const w = typeof props.width === 'number' ? `${props.width}px` : props.width;
    const style: Record<string, string> = {
      width: w,
    };
    if (props.zIndex !== undefined) {
      style.zIndex = String(props.zIndex);
    }
    return style;
  });

  const showFooter = computed(() => props.footer !== false && props.footer !== null);

  watch(
    () => props.open,
    (val) => {
      if (val) {
        if (props.lockScroll !== false && !releaseScrollLock) {
          releaseScrollLock = acquireScrollLock(props.lockScrollEl ?? null);
        }
      } else {
        releaseIfNeeded();
      }
    },
    { immediate: true }
  );

  watch(
    () => props.lockScrollEl,
    (nextEl) => {
      if (!props.open) return;
      if (props.lockScroll === false) return;
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
  // Ant Design 5.x inspired Modal styles
  .gf-modal__root {
    position: fixed;
    inset: 0;
    z-index: var(--gf-z-modal);
    overflow: auto;
    background: transparent;
  }

  .gf-modal__mask {
    position: fixed;
    inset: 0;
    background: var(--gf-color-mask);
    z-index: 1;
  }

  .gf-modal__wrap {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 100%;
    padding: 24px 16px;
    padding-top: 100px;

    &.is-centered {
      align-items: center;
      padding-top: 24px;
    }
  }

  .gf-modal__content {
    position: relative;
    background: var(--gf-color-bg-elevated);
    border-radius: var(--gf-radius-lg);
    box-shadow: var(--gf-shadow-3);
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    pointer-events: auto;
  }

  .gf-modal__close {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--gf-color-text-quaternary);
    cursor: pointer;
    border-radius: var(--gf-radius-sm);
    transition: all var(--gf-motion-normal) var(--gf-easing);

    &:hover {
      color: var(--gf-color-text-secondary);
      background: var(--gf-color-fill);
    }

    &:active {
      color: var(--gf-color-text);
    }
  }

  .gf-modal__header {
    padding: 16px 24px;
    flex-shrink: 0;
    border-radius: var(--gf-radius-lg) var(--gf-radius-lg) 0 0;
  }

  .gf-modal__title {
    margin: 0;
    font-size: var(--gf-font-size-lg);
    font-weight: 600;
    line-height: 1.5;
    color: var(--gf-color-text-heading);
    word-wrap: break-word;
  }

  .gf-modal__body {
    padding: 0 24px 24px;
    font-size: var(--gf-font-size-md);
    line-height: 1.5714285714;
    overflow: auto;
    flex: 1;
    color: var(--gf-color-text);
  }

  .gf-modal__footer {
    padding: 12px 16px;
    border-top: 1px solid var(--gf-color-border-secondary);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-shrink: 0;
    border-radius: 0 0 var(--gf-radius-lg) var(--gf-radius-lg);
    background: var(--gf-color-bg-elevated);
  }

  // Animations - Ant Design 5.x motion
  .gf-fade-enter-active,
  .gf-fade-leave-active {
    transition: opacity var(--gf-motion-normal) var(--gf-easing);
  }

  .gf-fade-enter-from,
  .gf-fade-leave-to {
    opacity: 0;
  }

  .gf-zoom-enter-active {
    transition:
      opacity var(--gf-motion-normal) var(--gf-easing-out),
      transform var(--gf-motion-normal) var(--gf-easing-out);
  }

  .gf-zoom-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing-in),
      transform var(--gf-motion-fast) var(--gf-easing-in);
  }

  .gf-zoom-enter-from {
    opacity: 0;
    transform: scale(0.8);
  }

  .gf-zoom-leave-to {
    opacity: 0;
    transform: scale(0.9);
  }
</style>
