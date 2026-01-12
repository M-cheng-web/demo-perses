<!-- 组件说明：模态对话框，支持自定义页眉/页脚、ESC 关闭等 -->
<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="open" :class="bem()" v-bind="$attrs">
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
  import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import Button from '../base/Button.vue';

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
      /** 是否监听 ESC 关闭 */
      keyboard?: boolean;
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
      keyboard: true,
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

  const panelStyle = computed(() => {
    const w = typeof props.width === 'number' ? `${props.width}px` : props.width;
    return { width: w, maxWidth: '90vw' };
  });

  const showFooter = computed(() => props.footer !== false && props.footer !== null);

  const handleEsc = (event: KeyboardEvent) => {
    if (!props.keyboard) return;
    if (event.key === 'Escape' && props.open) {
      handleCancel();
    }
  };

  watch(
    () => props.open,
    (val) => {
      if (val) {
        window.addEventListener('keydown', handleEsc);
      } else {
        window.removeEventListener('keydown', handleEsc);
      }
    }
  );

  onMounted(() => {
    if (props.open) {
      window.addEventListener('keydown', handleEsc);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEsc);
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
    padding: var(--gf-space-3) var(--gf-space-4);
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
    border-radius: var(--gf-radius-sm);
    transition: all 0.2s var(--gf-easing);

    &:hover {
      color: var(--gf-primary-strong);
      background: var(--gf-primary-soft);
    }
  }

  .gf-modal__body {
    padding: var(--gf-space-4);
    overflow: auto;
  }

  .gf-modal__footer {
    padding: var(--gf-space-3) var(--gf-space-4);
    border-top: 1px solid var(--gf-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    background: var(--gf-color-surface-muted);
  }
</style>
