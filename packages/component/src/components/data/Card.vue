<!-- 组件说明：卡片容器，支持标题、额外区域、悬浮阴影与边框控制 -->
<template>
  <div
    :class="[bem(), bem(`size-${size}`), { 'is-hoverable': hoverable, 'is-borderless': bordered === false }]"
    @click="$emit('click')"
  >
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

  withDefaults(
    defineProps<{
      /** 卡片标题文本 */
      title?: string;
      /** 尺寸（用于高密度信息展示） */
      size?: 'small' | 'middle';
      /** 悬浮时提升阴影 */
      hoverable?: boolean;
      /** 是否展示边框 */
      bordered?: boolean;
    }>(),
    {
      title: '',
      size: 'middle',
      hoverable: false,
      bordered: true,
    }
  );

  const emit = defineEmits<{
    (e: 'click'): void;
  }>();

  const [_, bem] = createNamespace('card');
</script>

<style scoped lang="less">
  .gf-card {
    --gf-card-border: var(--gf-color-border-muted);
    --gf-card-pad-x: var(--gf-space-4);
    --gf-card-pad-y: var(--gf-space-3);

    border: 1px solid var(--gf-card-border);
    border-radius: var(--gf-radius-md);
    background: var(--gf-card-bg, var(--gf-color-surface));
    box-shadow: none;
    transition: box-shadow var(--gf-motion-normal) var(--gf-easing), border-color var(--gf-motion-normal) var(--gf-easing),
      background var(--gf-motion-normal) var(--gf-easing);
    display: flex;
    flex-direction: column;

    &--size-small {
      --gf-card-pad-x: var(--gf-space-3);
      --gf-card-pad-y: var(--gf-space-2);
    }

    &.is-hoverable:hover {
      box-shadow: var(--gf-shadow-1);
      border-color: var(--gf-color-border-strong);
    }

    &.is-borderless {
      border-color: transparent;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--gf-card-pad-y) var(--gf-card-pad-x);
      border-bottom: 1px solid var(--gf-color-border-muted);
    }

    &__title {
      font-weight: 600;
      color: var(--gf-text);
    }

    &__body {
      padding: var(--gf-card-pad-y) var(--gf-card-pad-x);
      display: flex;
      flex-direction: column;
      gap: var(--gf-space-3);
    }
  }
</style>
