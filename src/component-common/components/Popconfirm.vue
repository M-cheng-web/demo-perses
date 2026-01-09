<template>
  <div ref="triggerRef" :class="bem()" @click.stop="toggle">
    <slot />
  </div>
  <teleport to="body">
    <transition name="cc-tooltip-fade">
      <div v-if="open" :class="['cc-popconfirm', 'ant-popover', bem('overlay')]" :style="overlayStyle">
        <div :class="bem('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div :class="bem('actions')">
          <Button size="small" @click="handleCancel">{{ cancelText }}</Button>
          <Button type="primary" size="small" @click="handleConfirm">{{ okText }}</Button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
  import { nextTick, onBeforeUnmount, ref } from 'vue';
  import { createNamespace } from '@/utils';
  import Button from './Button.vue';

  const props = withDefaults(
    defineProps<{
      title?: string;
      okText?: string;
      cancelText?: string;
    }>(),
    {
      title: '确定执行该操作？',
      okText: '确定',
      cancelText: '取消',
    }
  );

  const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('popconfirm');
  const triggerRef = ref<HTMLElement>();
  const overlayStyle = ref<Record<string, string>>({});
  const open = ref(false);

  const updatePosition = () => {
    nextTick(() => {
      const trigger = triggerRef.value;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      overlayStyle.value = {
        position: 'absolute',
        top: `${rect.bottom + 6 + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
      };
    });
  };

  const toggle = () => {
    open.value = !open.value;
    if (open.value) updatePosition();
  };

  const handleConfirm = () => {
    emit('confirm');
    open.value = false;
  };

  const handleCancel = () => {
    emit('cancel');
    open.value = false;
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (!open.value) return;
    const target = event.target as Node;
    if (triggerRef.value?.contains(target)) return;
    open.value = false;
  };

  document.addEventListener('click', handleClickOutside);

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style scoped lang="less">
  .dp-popconfirm__overlay {
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-radius-sm);
    padding: 12px;
    box-shadow: var(--cc-shadow);
    min-width: 200px;
    z-index: 2200;
  }

  .dp-popconfirm__title {
    margin-bottom: 12px;
    font-weight: 600;
    color: var(--cc-text);
  }

  .dp-popconfirm__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
