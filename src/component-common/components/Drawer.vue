<template>
  <teleport to="body">
    <div v-if="open" :class="['cc-drawer', 'ant-drawer', bem()]">
      <div class="cc-drawer__mask ant-drawer-mask" @click="handleMask" />
      <div
        class="cc-drawer__panel ant-drawer-content-wrapper"
        :style="panelStyle"
        @keydown.esc="handleClose"
      >
        <div class="ant-drawer-content">
          <div class="cc-drawer__header ant-drawer-header">
            <div class="ant-drawer-title">
              <slot name="title">{{ title }}</slot>
            </div>
            <span class="ant-drawer-close" role="button" @click="handleClose">×</span>
          </div>
          <div class="cc-drawer__body ant-drawer-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="cc-drawer__footer ant-drawer-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      open?: boolean;
      title?: string;
      width?: number | string;
      placement?: 'left' | 'right';
      maskClosable?: boolean;
      keyboard?: boolean;
    }>(),
    {
      open: false,
      title: '',
      width: 520,
      placement: 'right',
      maskClosable: true,
      keyboard: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:open', val: boolean): void;
    (e: 'close'): void;
  }>();

  const [_, bem] = createNamespace('drawer');

  const panelStyle = computed(() => {
    const style: Record<string, string> = {
      width: typeof props.width === 'number' ? `${props.width}px` : String(props.width),
      [props.placement === 'left' ? 'left' : 'right']: '0',
    };
    return style;
  });

  watch(
    () => props.open,
    (val) => {
      document.body.style.overflow = val ? 'hidden' : '';
    },
    { immediate: true }
  );

  const handleClose = () => {
    emit('update:open', false);
    emit('close');
  };

  const handleMask = () => {
    if (props.maskClosable) {
      handleClose();
    }
  };
</script>

<style scoped lang="less">
  .dp-drawer {
    &__panel {
      min-width: 280px;
    }

    .ant-drawer-close {
      cursor: pointer;
      color: var(--cc-text-secondary);
    }
  }
</style>
