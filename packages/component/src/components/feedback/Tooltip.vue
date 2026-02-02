<!-- 组件说明：悬停提示气泡，跟随触发元素定位 -->
<template>
  <span :class="bem()" ref="triggerRef" v-bind="$attrs" @mouseenter="openTooltip" @mouseleave="closeTooltip">
    <slot></slot>
    <Teleport :to="portalTarget">
      <transition name="fade">
        <div v-if="visible" :class="[bem('popup'), themeClass]" :data-gf-theme="colorScheme" :style="popupStyle" ref="popupRef">
          <slot name="title">
            {{ title }}
          </slot>
        </div>
      </transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
  import { computed, inject, nextTick, ref } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfTooltip' });

  const props = withDefaults(
    defineProps<{
      /** 提示文案或插槽内容 */
      title?: string;
      /**
       * 气泡位置
       * - 目前仅支持 top/bottom/left/right（满足 QueryBuilder 的基本需求）
       */
      placement?: 'top' | 'bottom' | 'left' | 'right';
    }>(),
    {
      placement: 'top',
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

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const openTooltip = async () => {
    visible.value = true;
    await nextTick();
    const trigger = triggerRef.value;
    const popup = popupRef.value;
    if (!trigger || !popup) return;
    const rect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const padding = 8;
    let left = rect.left + rect.width / 2;
    let top = rect.top - 8;

    left = clamp(left, padding + popupRect.width / 2, window.innerWidth - padding - popupRect.width / 2);

    if (props.placement === 'bottom') {
      top = rect.bottom + popupRect.height + 8;
      if (top - popupRect.height < padding) top = rect.bottom + popupRect.height + 8;
    } else if (props.placement === 'left') {
      left = rect.left - 8;
      top = rect.top + rect.height / 2 + popupRect.height;
      left = clamp(left, padding + popupRect.width / 2, window.innerWidth - padding - popupRect.width / 2);
    } else if (props.placement === 'right') {
      left = rect.right + 8;
      top = rect.top + rect.height / 2 + popupRect.height;
      left = clamp(left, padding + popupRect.width / 2, window.innerWidth - padding - popupRect.width / 2);
    } else {
      // default: top
      if (top - popupRect.height < padding) {
        top = rect.bottom + popupRect.height + 8;
      }
    }

    popupStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const closeTooltip = () => {
    visible.value = false;
  };
</script>

<style scoped lang="less">
  .gf-tooltip {
    position: relative;
    display: inline-flex;
  }

  .gf-tooltip__popup {
    position: fixed;
    transform: translate(-50%, -100%);
    background: var(--gf-color-tooltip-bg);
    color: var(--gf-color-tooltip-text);
    border-radius: var(--gf-radius-sm);
    padding: 8px 10px;
    font-size: 12px;
    border: 1px solid var(--gf-border);
    box-shadow: var(--gf-shadow-2);
    pointer-events: none;
    white-space: nowrap;
    z-index: var(--gf-z-tooltip);
  }
</style>
