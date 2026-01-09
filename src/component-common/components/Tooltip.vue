<template>
  <div ref="triggerRef" :class="[bem(), 'cc-tooltip-trigger']" @mouseenter="show" @mouseleave="hide">
    <slot />
  </div>
  <teleport to="body">
    <transition name="cc-tooltip-fade">
      <div v-if="visible" :class="['cc-tooltip', bem('popup'), 'ant-tooltip']" :style="popupStyle">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, reactive, ref } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      title?: string;
      placement?: 'top' | 'bottom' | 'left' | 'right';
    }>(),
    {
      title: '',
      placement: 'top',
    }
  );

  const [_, bem] = createNamespace('tooltip');
  const triggerRef = ref<HTMLElement>();
  const visible = ref(false);
  const coords = reactive({ top: 0, left: 0 });

  const updatePosition = () => {
    const el = triggerRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = 8;
    switch (props.placement) {
      case 'bottom':
        coords.top = rect.bottom + offset + window.scrollY;
        coords.left = rect.left + rect.width / 2 + window.scrollX;
        break;
      case 'left':
        coords.top = rect.top + rect.height / 2 + window.scrollY;
        coords.left = rect.left + window.scrollX - offset;
        break;
      case 'right':
        coords.top = rect.top + rect.height / 2 + window.scrollY;
        coords.left = rect.right + window.scrollX + offset;
        break;
      default:
        coords.top = rect.top + window.scrollY - offset;
        coords.left = rect.left + rect.width / 2 + window.scrollX;
    }
  };

  const popupStyle = computed(() => {
    return {
      top: `${coords.top}px`,
      left: `${coords.left}px`,
      transform: 'translate(-50%, -100%)',
    };
  });

  const show = () => {
    updatePosition();
    visible.value = true;
  };

  const hide = () => {
    visible.value = false;
  };

  onBeforeUnmount(() => hide());
</script>

<style scoped>
  .dp-tooltip {
    display: inline-flex;
  }
</style>
