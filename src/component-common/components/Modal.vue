<template>
  <teleport to="body">
    <div v-if="openState" :class="['cc-modal', 'ant-modal', bem()]">
      <div class="cc-modal__mask ant-modal-mask" @click="handleMaskClick" />
      <div class="cc-modal__wrap ant-modal-wrap" :style="{ width: typeof width === 'number' ? `${width}px` : width }">
        <div class="cc-modal__content ant-modal-content">
          <div v-if="closable" class="cc-modal__close" @click="handleCancel">×</div>
          <div class="cc-modal__header ant-modal-header">
            <slot name="title">
              <span class="cc-modal__title">{{ title }}</span>
            </slot>
          </div>
          <div class="cc-modal__body ant-modal-body" :style="bodyStyle">
            <slot />
          </div>
          <div v-if="footer !== null" class="cc-modal__footer ant-modal-footer">
            <slot name="footer">
              <Button @click="handleCancel">{{ cancelText }}</Button>
              <Button type="primary" :loading="confirmLoading" @click="handleOk">{{ okText }}</Button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { createNamespace } from '@/utils';
  import Button from './Button.vue';

  const props = withDefaults(
    defineProps<{
      open?: boolean;
      title?: string;
      width?: number | string;
      footer?: null | unknown;
      bodyStyle?: Record<string, any>;
      maskClosable?: boolean;
      keyboard?: boolean;
      centered?: boolean;
      closable?: boolean;
      destroyOnClose?: boolean;
      confirmLoading?: boolean;
      okText?: string;
      cancelText?: string;
    }>(),
    {
      open: false,
      title: '',
      width: 520,
      footer: undefined,
      bodyStyle: undefined,
      maskClosable: true,
      keyboard: true,
      centered: false,
      closable: true,
      destroyOnClose: false,
      confirmLoading: false,
      okText: '确定',
      cancelText: '取消',
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', val: boolean): void;
    (e: 'ok'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('modal');

  const openState = computed({
    get: () => props.open,
    set: (val: boolean) => emit('update:open', val),
  });

  watch(
    () => props.open,
    (val) => {
      document.body.style.overflow = val ? 'hidden' : '';
    },
    { immediate: true }
  );

  const close = () => {
    if (props.destroyOnClose) {
      emit('update:open', false);
    } else {
      openState.value = false;
    }
  };

  const handleMaskClick = () => {
    if (props.maskClosable) {
      handleCancel();
    }
  };

  const handleCancel = () => {
    close();
    emit('cancel');
  };

  const handleOk = () => {
    emit('ok');
  };
</script>

<style scoped lang="less">
  .dp-modal {
    display: flex;
    align-items: center;
    justify-content: center;

    &__content {
      position: relative;
    }

    &__title {
      font-size: 16px;
    }

    &__close {
      position: absolute;
      top: 10px;
      right: 12px;
      cursor: pointer;
      color: var(--cc-text-secondary);
      z-index: 2;
    }
  }
</style>
