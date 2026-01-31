<!-- 组件说明：下拉触发器，点击触发自定义浮层 -->
<template>
  <div :class="bem()" ref="triggerRef">
    <div :class="bem('trigger')" @click="toggle">
      <slot></slot>
    </div>
    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" :class="[bem('overlay'), themeClass]" :data-gf-theme="colorScheme" :style="overlayStyle" ref="overlayRef" @click="close">
          <slot name="overlay"></slot>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';

  defineOptions({ name: 'GfDropdown' });

  const [_, bem] = createNamespace('dropdown');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const triggerRef = ref<HTMLElement>();
  const overlayRef = ref<HTMLElement>();
  const open = ref(false);
  const overlayStyle = ref<Record<string, string>>({});
  let rafId: number | null = null;

  const scheduleUpdatePosition = () => {
    if (!open.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updatePosition();
    });
  };

  const toggle = () => {
    open.value = !open.value;
    if (open.value) {
      updatePosition();
    }
  };

  const close = () => (open.value = false);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const updatePosition = async () => {
    const trigger = triggerRef.value;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    await nextTick();
    const overlay = overlayRef.value;
    const width = overlay?.offsetWidth || rect.width;
    const height = overlay?.offsetHeight || 0;
    const padding = 8;
    let left = rect.left;
    let top = rect.bottom + 6;

    left = clamp(left, padding, window.innerWidth - width - padding);
    if (top + height > window.innerHeight - padding) {
      top = rect.top - height - 6;
      if (top < padding) top = padding;
    }

    overlayStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      minWidth: `${rect.width}px`,
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
    window.removeEventListener('scroll', scheduleUpdatePosition, true);
    if (rafId != null) cancelAnimationFrame(rafId);
  });

  watch(
    () => open.value,
    (val) => {
      if (val) {
        window.addEventListener('scroll', scheduleUpdatePosition, true);
      } else {
        window.removeEventListener('scroll', scheduleUpdatePosition, true);
      }
    }
  );
</script>

<style scoped lang="less">
  .gf-dropdown {
    display: inline-flex;
    position: relative;

    &__overlay {
      position: fixed;
      z-index: var(--gf-z-popover);
      background: var(--gf-surface);
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-md);
      box-shadow: var(--gf-shadow-2);
      overflow: hidden;
    }
  }
</style>
