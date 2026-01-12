<!-- 组件说明：卡片容器，支持标题、额外区域、悬浮阴影与边框控制 -->
<template>
  <div :class="[bem(), { 'is-hoverable': hoverable, 'is-borderless': bordered === false }]" @click="$emit('click')">
    <div v-if="title || $slots.extra" :class="bem('header')">
      <span :class="bem('title')">{{ title }}</span>
      <div v-if="$slots.extra" :class="bem('extra')">
        <slot name="extra"></slot>
      </div>
    </div>
    <div :class="bem('body')">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfCard' });

  defineProps<{
    /** 卡片标题文本 */
    title?: string;
    /** 悬浮时提升阴影 */
    hoverable?: boolean;
    /** 是否展示边框 */
    bordered?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'click'): void;
  }>();

  const [_, bem] = createNamespace('card');
</script>

<style scoped lang="less">
  .gf-card {
    border: 1px solid var(--gf-border);
    border-radius: var(--gf-radius-md);
    background: var(--gf-color-surface);
    box-shadow: var(--gf-shadow-1);
    transition: box-shadow var(--gf-motion-normal) var(--gf-easing), border-color var(--gf-motion-normal) var(--gf-easing);
    display: flex;
    flex-direction: column;

    &.is-hoverable:hover {
      box-shadow: var(--gf-shadow-2);
      border-color: var(--gf-border-strong);
    }

    &.is-borderless {
      border-color: transparent;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--gf-space-3) var(--gf-space-4);
      border-bottom: 1px solid var(--gf-border);
    }

    &__title {
      font-weight: 600;
      color: var(--gf-text);
    }

    &__body {
      padding: var(--gf-space-3) var(--gf-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--gf-space-3);
    }
  }
</style>
