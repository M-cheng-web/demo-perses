<!-- 组件说明：悬停提示气泡，跟随触发元素定位 (AntD-inspired) -->
<template>
  <span
    :class="bem()"
    ref="triggerRef"
    v-bind="$attrs"
    @mouseenter="openTooltip"
    @mouseleave="scheduleClose"
    @focusin="openTooltip"
    @focusout="scheduleClose"
  >
    <slot></slot>
    <Teleport :to="portalTarget">
      <Transition name="gf-zoom-big-fast">
        <div
          v-if="visible"
          :class="[bem('content'), bem('content', placement), themeClass]"
          :data-gf-theme="colorScheme"
          :style="popupStyle"
          ref="popupRef"
          @mouseenter="cancelClose"
          @mouseleave="scheduleClose"
        >
          <div :class="bem('arrow')"></div>
          <div :class="bem('inner')">
            <slot name="title">
              {{ title }}
            </slot>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, ref, onBeforeUnmount } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfTooltip' });

  const props = withDefaults(
    defineProps<{
      /** 提示文案或插槽内容 */
      title?: string;
      /** 气泡位置 */
      placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
      /** 背景颜色 */
      color?: string;
      /** 延迟显示时间 (ms) */
      mouseEnterDelay?: number;
      /** 延迟隐藏时间 (ms) */
      mouseLeaveDelay?: number;
    }>(),
    {
      title: '',
      placement: 'top',
      color: undefined,
      mouseEnterDelay: 100,
      mouseLeaveDelay: 100,
    }
  );

  const [_, bem] = createNamespace('tooltip');
  const themeContext = inject(GF_THEME_CONTEXT_KEY, null);
  const themeClass = computed(() => themeContext?.themeClass.value);
  const colorScheme = computed(() => themeContext?.colorScheme.value);
  const portalContext = inject(GF_PORTAL_CONTEXT_KEY, null);
  const portalTarget = computed(() => portalContext?.target.value ?? 'body');
  const triggerRef = ref<HTMLElement>();
  const popupRef = ref<HTMLElement>();
  const visible = ref(false);
  const popupStyle = ref<Record<string, string>>({});

  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const clearTimers = () => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const openTooltip = async () => {
    clearTimers();
    openTimer = setTimeout(async () => {
      visible.value = true;
      await nextTick();
      updatePosition();
    }, props.mouseEnterDelay);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer = setTimeout(() => {
      visible.value = false;
    }, props.mouseLeaveDelay);
  };

  const cancelClose = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const updatePosition = () => {
    const trigger = triggerRef.value;
    const popup = popupRef.value;
    if (!trigger || !popup) return;

    const rect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const padding = 8;
    const arrowSize = 8;

    let left = 0;
    let top = 0;

    // Calculate base position
    switch (props.placement) {
      case 'top':
      case 'topLeft':
      case 'topRight':
        top = rect.top - popupRect.height - arrowSize;
        break;
      case 'bottom':
      case 'bottomLeft':
      case 'bottomRight':
        top = rect.bottom + arrowSize;
        break;
      case 'left':
        left = rect.left - popupRect.width - arrowSize;
        top = rect.top + (rect.height - popupRect.height) / 2;
        break;
      case 'right':
        left = rect.right + arrowSize;
        top = rect.top + (rect.height - popupRect.height) / 2;
        break;
    }

    // Horizontal positioning for top/bottom
    if (props.placement === 'top' || props.placement === 'bottom') {
      left = rect.left + (rect.width - popupRect.width) / 2;
    } else if (props.placement === 'topLeft' || props.placement === 'bottomLeft') {
      left = rect.left;
    } else if (props.placement === 'topRight' || props.placement === 'bottomRight') {
      left = rect.right - popupRect.width;
    }

    // Clamp to viewport
    left = clamp(left, padding, window.innerWidth - popupRect.width - padding);
    top = clamp(top, padding, window.innerHeight - popupRect.height - padding);

    const style: Record<string, string> = {
      left: `${left}px`,
      top: `${top}px`,
    };

    if (props.color) {
      style['--gf-tooltip-bg'] = props.color;
    }

    popupStyle.value = style;
  };

  onBeforeUnmount(() => {
    clearTimers();
  });
</script>

<style scoped lang="less">
  .gf-tooltip {
    position: relative;
    display: inline-flex;
  }

  .gf-tooltip__content {
    position: fixed;
    z-index: var(--gf-z-tooltip);
    max-width: 250px;
    word-wrap: break-word;
    pointer-events: auto;
  }

  .gf-tooltip__arrow {
    position: absolute;
    width: 16px;
    height: 16px;
    background: transparent;
    pointer-events: none;

    &::before {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--gf-tooltip-bg, var(--gf-color-tooltip-bg));
      transform: rotate(45deg);
    }
  }

  .gf-tooltip__content--top,
  .gf-tooltip__content--topLeft,
  .gf-tooltip__content--topRight {
    .gf-tooltip__arrow {
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);

      &::before {
        bottom: 6px;
        left: 4px;
      }
    }
  }

  .gf-tooltip__content--topLeft .gf-tooltip__arrow {
    left: 16px;
    transform: none;
  }

  .gf-tooltip__content--topRight .gf-tooltip__arrow {
    left: auto;
    right: 16px;
    transform: none;
  }

  .gf-tooltip__content--bottom,
  .gf-tooltip__content--bottomLeft,
  .gf-tooltip__content--bottomRight {
    .gf-tooltip__arrow {
      top: -4px;
      left: 50%;
      transform: translateX(-50%);

      &::before {
        top: 6px;
        left: 4px;
      }
    }
  }

  .gf-tooltip__content--bottomLeft .gf-tooltip__arrow {
    left: 16px;
    transform: none;
  }

  .gf-tooltip__content--bottomRight .gf-tooltip__arrow {
    left: auto;
    right: 16px;
    transform: none;
  }

  .gf-tooltip__content--left {
    .gf-tooltip__arrow {
      right: -4px;
      top: 50%;
      transform: translateY(-50%);

      &::before {
        right: 6px;
        top: 4px;
      }
    }
  }

  .gf-tooltip__content--right {
    .gf-tooltip__arrow {
      left: -4px;
      top: 50%;
      transform: translateY(-50%);

      &::before {
        left: 6px;
        top: 4px;
      }
    }
  }

  .gf-tooltip__inner {
    padding: 6px 8px;
    background: var(--gf-tooltip-bg, var(--gf-color-tooltip-bg));
    color: var(--gf-color-tooltip-text);
    border-radius: var(--gf-radius-sm);
    font-size: var(--gf-font-size-sm);
    line-height: 1.5714285714285714;
    box-shadow: var(--gf-shadow-2);
  }

  // Animation
  .gf-zoom-big-fast-enter-active,
  .gf-zoom-big-fast-leave-active {
    transition:
      opacity 0.1s var(--gf-easing),
      transform 0.1s var(--gf-easing);
  }

  .gf-zoom-big-fast-enter-from,
  .gf-zoom-big-fast-leave-to {
    opacity: 0;
    transform: scale(0.8);
  }
</style>
