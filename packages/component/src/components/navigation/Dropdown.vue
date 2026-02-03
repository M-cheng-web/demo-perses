<!-- 组件说明：下拉触发器，点击触发自定义浮层 (AntD-inspired) -->
<template>
  <div :class="bem()" ref="triggerRef">
    <div :class="bem('trigger')" @click="toggle" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
      <slot></slot>
    </div>
    <Teleport :to="portalTarget">
      <Transition name="gf-slide-up">
        <div
          v-if="open"
          :class="[bem('overlay'), themeClass]"
          :data-gf-theme="colorScheme"
          :style="overlayStyle"
          ref="overlayRef"
          @click="handleOverlayClick"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        >
          <slot name="overlay"></slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfDropdown' });

  const props = withDefaults(
    defineProps<{
      /** 触发方式 */
      trigger?: 'click' | 'hover';
      /** 弹出位置 */
      placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
      /** 是否禁用 */
      disabled?: boolean;
    }>(),
    {
      trigger: 'hover',
      placement: 'bottomLeft',
      disabled: false,
    }
  );

  const [_, bem] = createNamespace('dropdown');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  const triggerRef = ref<HTMLElement>();
  const overlayRef = ref<HTMLElement>();
  const open = ref(false);
  const overlayStyle = ref<Record<string, string>>({});
  let rafId: number | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleUpdatePosition = () => {
    if (!open.value) return;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updatePosition();
    });
  };

  const toggle = () => {
    if (props.disabled) return;
    if (props.trigger === 'click') {
      open.value = !open.value;
      if (open.value) {
        updatePosition();
      }
    }
  };

  const handleMouseEnter = () => {
    if (props.disabled || props.trigger !== 'hover') return;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (!open.value) {
      open.value = true;
      updatePosition();
    }
  };

  const handleMouseLeave = () => {
    if (props.trigger !== 'hover') return;
    hoverTimer = setTimeout(() => {
      open.value = false;
    }, 100);
  };

  const handleOverlayClick = () => {
    open.value = false;
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
    const padding = 4;
    let left = rect.left;
    let top = rect.bottom + 4;

    // Handle horizontal placement
    if (props.placement === 'bottomRight' || props.placement === 'topRight') {
      left = rect.right - width;
    }

    // Handle vertical placement
    if (props.placement === 'topLeft' || props.placement === 'topRight') {
      top = rect.top - height - 4;
    }

    // Clamp to viewport
    left = clamp(left, padding, window.innerWidth - width - padding);
    if (top + height > window.innerHeight - padding) {
      top = rect.top - height - 4;
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
    if (overlayRef.value?.contains(evt.target as Node)) return;
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
    if (hoverTimer) clearTimeout(hoverTimer);
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

    &__trigger {
      cursor: pointer;
    }

    &__overlay {
      position: fixed;
      z-index: var(--gf-z-popover);
      background: var(--gf-color-surface);
      border-radius: var(--gf-radius-lg);
      box-shadow: var(--gf-shadow-2);
      overflow: hidden;
      padding: 4px;
    }
  }

  // Animation
  .gf-slide-up-enter-active,
  .gf-slide-up-leave-active {
    transition:
      opacity var(--gf-motion-fast) var(--gf-easing),
      transform var(--gf-motion-fast) var(--gf-easing);
    transform-origin: top center;
  }

  .gf-slide-up-enter-from,
  .gf-slide-up-leave-to {
    opacity: 0;
    transform: scaleY(0.8);
  }
</style>
