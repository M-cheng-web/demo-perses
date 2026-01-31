<!-- 组件说明：二次确认气泡，包含确认/取消操作 -->
<template>
  <div :class="bem()" ref="triggerRef">
    <span @click="toggle">
      <slot></slot>
    </span>
    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="[bem('content'), themeClass]" :data-gf-theme="colorScheme" :style="popupStyle" ref="popupRef">
          <div :class="bem('message')">
            <slot name="title">{{ title }}</slot>
          </div>
          <div :class="bem('actions')">
            <Button size="small" type="ghost" @click="handleCancel">取消</Button>
            <Button size="small" type="primary" danger @click="handleConfirm">确认</Button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { createNamespace } from '../../utils';
  import Button from '../base/Button.vue';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';

  defineOptions({ name: 'GfPopconfirm' });

  const _props = withDefaults(
    defineProps<{
      /** 确认提示文案 */
      title?: string;
    }>(),
    {
      title: '确认执行该操作？',
    }
  );

  const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();

  const [_, bem] = createNamespace('popconfirm');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const triggerRef = ref<HTMLElement>();
  const popupRef = ref<HTMLElement>();
  const open = ref(false);
  const popupStyle = ref<Record<string, string>>({});

  const toggle = () => {
    open.value = !open.value;
    if (open.value) updatePosition();
  };

  const close = () => (open.value = false);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const updatePosition = async () => {
    const trigger = triggerRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    await nextTick();
    const popup = popupRef.value;
    const popupRect = popup?.getBoundingClientRect();
    const width = popupRect?.width || 0;
    const height = popupRect?.height || 0;
    const padding = 8;
    let left = rect.left + rect.width / 2;
    let top = rect.top - 10;

    left = clamp(left, padding + width / 2, window.innerWidth - padding - width / 2);
    if (top - height < padding) {
      top = rect.bottom + height + 10;
    }

    popupStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const handleOutside = (evt: MouseEvent) => {
    if (!triggerRef.value) return;
    if (triggerRef.value.contains(evt.target as Node)) return;
    close();
  };

  onMounted(() => {
    window.addEventListener('click', handleOutside);
    window.addEventListener('resize', updatePosition);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('click', handleOutside);
    window.removeEventListener('resize', updatePosition);
  });

  const handleConfirm = () => {
    emit('confirm');
    close();
  };

  const handleCancel = () => {
    emit('cancel');
    close();
  };
</script>

<style scoped lang="less">
  .gf-popconfirm {
    display: inline-flex;
    position: relative;

    &__content {
      position: fixed;
      transform: translate(-50%, -100%);
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-md);
      box-shadow: var(--gf-shadow-2);
      padding: 10px 12px;
      color: var(--gf-text);
      min-width: 180px;
      z-index: var(--gf-z-popover);
    }

    &__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 10px;
    }

    &__message {
      font-size: var(--gf-font-size-md);
      color: var(--gf-text-secondary);
    }
  }
</style>
