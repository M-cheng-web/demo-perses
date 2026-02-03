<!-- 组件说明：卡片容器，支持标题、额外区域、悬浮阴影与边框控制 (AntD-inspired) -->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      { 'is-hoverable': hoverable, 'is-borderless': bordered === false, 'is-loading': loading }
    ]"
    @click="emit('click')"
  >
    <div v-if="title || $slots.title || $slots.extra" :class="bem('header')">
      <div :class="bem('header-wrapper')">
        <div :class="bem('title')">
          <slot name="title">{{ title }}</slot>
        </div>
      </div>
      <div v-if="$slots.extra" :class="bem('extra')">
        <slot name="extra"></slot>
      </div>
    </div>
    <div v-if="$slots.cover" :class="bem('cover')">
      <slot name="cover"></slot>
    </div>
    <div :class="bem('body')" :style="bodyStyle">
      <template v-if="loading">
        <div :class="bem('loading-block')"></div>
        <div :class="bem('loading-block')" style="width: 80%"></div>
        <div :class="bem('loading-block')" style="width: 60%"></div>
      </template>
      <slot v-else></slot>
    </div>
    <div v-if="$slots.actions" :class="bem('actions')">
      <slot name="actions"></slot>
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
      size?: 'small' | 'default';
      /** 悬浮时提升阴影 */
      hoverable?: boolean;
      /** 是否展示边框 */
      bordered?: boolean;
      /** 是否显示加载状态 */
      loading?: boolean;
      /** body 区域自定义样式 */
      bodyStyle?: Record<string, string>;
    }>(),
    {
      title: '',
      size: 'default',
      hoverable: false,
      bordered: true,
      loading: false,
      bodyStyle: undefined,
    }
  );

  const emit = defineEmits<{
    (e: 'click'): void;
  }>();

  const [_, bem] = createNamespace('card');
</script>

<style scoped lang="less">
  .gf-card {
    border: 1px solid var(--gf-color-border);
    border-radius: var(--gf-radius-lg);
    background: var(--gf-color-surface);
    box-shadow: none;
    transition:
      box-shadow var(--gf-motion-normal) var(--gf-easing),
      border-color var(--gf-motion-normal) var(--gf-easing);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &.is-hoverable {
      cursor: pointer;

      &:hover {
        box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09);
      }
    }

    &.is-borderless {
      border-color: transparent;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 56px;
      padding: 0 24px;
      border-bottom: 1px solid var(--gf-color-border);
    }

    &__header-wrapper {
      flex: 1;
      min-width: 0;
    }

    &__title {
      font-weight: 600;
      font-size: var(--gf-font-size-md);
      line-height: 1.5;
      color: var(--gf-color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__extra {
      flex-shrink: 0;
      margin-left: auto;
      color: var(--gf-color-text-secondary);
      font-size: var(--gf-font-size-sm);
    }

    &__cover {
      margin: -1px -1px 0;
      overflow: hidden;

      img {
        display: block;
        width: 100%;
      }
    }

    &__body {
      padding: 24px;
      flex: 1;
      font-size: var(--gf-font-size-sm);
      line-height: 1.5714285714285714;
      color: var(--gf-color-text);
    }

    &__actions {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      border-top: 1px solid var(--gf-color-border);
      background: var(--gf-color-fill);

      :deep(> *) {
        flex: 1;
        text-align: center;
      }

      :deep(> *:not(:last-child)) {
        border-right: 1px solid var(--gf-color-border);
      }
    }

    &__loading-block {
      height: 16px;
      margin-bottom: 16px;
      background: linear-gradient(
        90deg,
        var(--gf-color-fill-secondary) 25%,
        var(--gf-color-fill-tertiary) 37%,
        var(--gf-color-fill-secondary) 63%
      );
      background-size: 400% 100%;
      animation: gf-card-loading 1.4s ease infinite;
      border-radius: var(--gf-radius-xs);

      &:last-child {
        margin-bottom: 0;
      }
    }

    // Size small
    &--size-small &__header {
      min-height: 38px;
      padding: 0 12px;
      font-size: var(--gf-font-size-sm);
    }

    &--size-small &__body {
      padding: 12px;
    }
  }

  @keyframes gf-card-loading {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }
</style>
