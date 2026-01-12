<!-- 组件说明：悬停提示气泡，跟随触发元素定位 -->
<template>
  <span :class="bem()" ref="triggerRef" @mouseenter="openTooltip" @mouseleave="closeTooltip">
    <slot></slot>
  </span>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" :class="bem('popup')" :style="popupStyle" ref="popupRef">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { nextTick, ref } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTooltip' });

  const props = defineProps<{
    /** 提示文案或插槽内容 */
    title?: string;
  }>();

  const [_, bem] = createNamespace('tooltip');
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

    if (top - popupRect.height < padding) {
      top = rect.bottom + popupRect.height + 8;
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
