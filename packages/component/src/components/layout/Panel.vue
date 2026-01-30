<!--
  组件说明：通用 Panel 容器（头部 + 内容）
  - 支持标题 / description Tooltip / 折叠
  - 支持右侧操作区 slot（#right）
  - size 用于控制密度（面板组：large；单图表：small）
-->
<template>
  <div
    :class="[
      bem(),
      bem({ [`size-${size}`]: true }),
      {
        'is-hoverable': hoverable,
        'is-borderless': bordered === false,
        'is-ghost': ghost,
        'is-flat': isFlat,
        'is-collapsible': collapsible,
      },
    ]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      v-if="hasHeader"
      :class="[bem('header'), { 'is-collapsible': collapsible }]"
      :role="collapsible ? 'button' : undefined"
      :tabindex="collapsible ? 0 : undefined"
      :aria-expanded="collapsible ? !collapsed : undefined"
      @click="handleHeaderClick"
      @keydown="handleHeaderKeydown"
    >
      <div
        v-if="collapsible"
        :class="[bem('collapse'), { 'is-expanded': !collapsed }]"
        role="button"
        tabindex="0"
        aria-label="切换折叠"
        @click.stop="toggleCollapse"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7.2 4.9a1 1 0 0 1 1.4 0l5.2 5.1a1 1 0 0 1 0 1.4l-5.2 5.1a1 1 0 1 1-1.4-1.4l4.5-4.4-4.5-4.4a1 1 0 0 1 0-1.4Z"
          />
        </svg>
      </div>

      <div :class="bem('title-area')">
        <div v-if="title" :class="bem('title')" @click.stop="handleTitleClick">{{ title }}</div>
        <Tooltip v-if="description" :title="description">
          <span :class="bem('info')" aria-label="描述" @click.stop>i</span>
        </Tooltip>
      </div>

      <div v-if="$slots.right" :class="bem('right')" @click.stop>
        <slot name="right" :hovered="isHovered"></slot>
      </div>
    </div>

    <Transition name="gf-panel-collapse">
      <div v-if="!collapsed" :class="[bem('body'), { 'is-body-padded': effectiveBodyPadding }]">
        <slot></slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, useSlots } from 'vue';
  import Tooltip from '../feedback/Tooltip.vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfPanel' });

  const props = withDefaults(
    defineProps<{
      /** 标题（展示于 header 左侧） */
      title?: string;
      /** 标题右侧 Tooltip 描述（存在时展示 info） */
      description?: string;
      /** 是否展示折叠按钮 */
      collapsible?: boolean;
      /** 折叠状态（建议由外部 store 持有） */
      collapsed?: boolean;
      /** 尺寸密度 */
      size?: 'small' | 'middle' | 'large';
      /** 是否展示边框 */
      bordered?: boolean;
      /** 无边框 + 透明背景（用于“分组/区块”容器，降低层级感） */
      ghost?: boolean;
      /** hover 是否提升边框/阴影（同时提供 `--panel-hover` 供 hover actions 使用） */
      hoverable?: boolean;
      /** 内容区是否增加 padding（单图表内容常自带 padding，可关闭） */
      bodyPadding?: boolean;
    }>(),
    {
      title: '',
      description: '',
      collapsible: false,
      collapsed: false,
      size: 'middle',
      bordered: true,
      ghost: false,
      hoverable: false,
      bodyPadding: true,
    }
  );

  const emit = defineEmits<{
    (e: 'update:collapsed', value: boolean): void;
    (e: 'toggle', value: boolean): void;
    (e: 'title-click'): void;
  }>();

  const [_, bem] = createNamespace('panel');

  const slots = useSlots();
  const hasHeader = computed(() => Boolean(props.title || props.description || props.collapsible || !!slots.right));
  const isHovered = ref(false);
  const isFlat = computed(() => props.bordered === false);
  const effectiveBodyPadding = computed(() => (props.bordered === false ? false : props.bodyPadding));

  const toggleCollapse = () => {
    const next = !props.collapsed;
    emit('update:collapsed', next);
    emit('toggle', next);
  };

  const handleHeaderClick = () => {
    if (!props.collapsible) return;
    toggleCollapse();
  };

  const handleHeaderKeydown = (event: KeyboardEvent) => {
    if (!props.collapsible) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleCollapse();
  };

  const handleTitleClick = () => {
    emit('title-click');
  };
</script>

<style scoped lang="less">
  .gf-panel {
    --panel-hover: none;
    --gf-panel-pad-x: var(--gf-space-4);
    --gf-panel-pad-y: var(--gf-space-3);
    --gf-panel-header-height: 40px;
    --gf-panel-title-size: 14px;

    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    background-color: var(--gf-color-surface);
    border: 1px solid var(--gf-color-border-muted);
    border-radius: var(--gf-radius-md);
    overflow: hidden;
    box-shadow: none;
    transition:
      border-color var(--gf-motion-normal) var(--gf-easing),
      box-shadow var(--gf-motion-normal) var(--gf-easing);

    &--size-small {
      --gf-panel-pad-x: var(--gf-space-3);
      --gf-panel-pad-y: var(--gf-space-2);
      --gf-panel-header-height: 34px;
      --gf-panel-title-size: 13px;
    }

    &--size-large {
      --gf-panel-pad-x: var(--gf-space-4);
      --gf-panel-pad-y: var(--gf-space-3);
      --gf-panel-header-height: 44px;
      --gf-panel-title-size: 14px;
    }

    &.is-hoverable:hover {
      --panel-hover: flex;
      border-color: var(--gf-color-border-strong);
      box-shadow: var(--gf-shadow-1);
    }

    &.is-borderless {
      border-color: transparent;
    }

    &.is-ghost {
      background-color: transparent;
      border-color: transparent;
      overflow: visible;
      box-shadow: none;
    }

    &.is-ghost.is-hoverable:hover {
      border-color: transparent;
      box-shadow: none;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--gf-space-2);
      min-height: var(--gf-panel-header-height);
      padding: 0 var(--gf-panel-pad-x);
      background: var(--gf-color-surface);
      border-bottom: 1px solid var(--gf-color-border-muted);
      flex-shrink: 0;

      &.is-collapsible {
        cursor: pointer;
        user-select: none;
      }

      &.is-collapsible:focus-visible {
        outline: none;
        box-shadow: var(--gf-focus-ring);
      }
    }

    &.is-ghost &__header {
      background: color-mix(in srgb, var(--gf-color-surface-muted), transparent 34%);
    }

    &__collapse {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid transparent;
      background: transparent;
      color: var(--gf-color-text-secondary);
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      transition:
        background-color var(--gf-motion-fast) var(--gf-easing),
        transform var(--gf-motion-fast) var(--gf-easing);

      &:hover {
        background: var(--gf-color-fill);
      }

      &.is-expanded {
        transform: rotate(90deg);
      }
    }

    &__title-area {
      display: flex;
      align-items: center;
      gap: var(--gf-space-2);
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    &__title {
      font-size: var(--gf-panel-title-size);
      font-weight: 650;
      letter-spacing: 0.2px;
      color: var(--gf-color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__info {
      width: 16px;
      height: 16px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      border: 1px solid var(--gf-color-border-muted);
      color: var(--gf-color-text-secondary);
      background: color-mix(in srgb, var(--gf-color-surface), transparent 10%);
      cursor: help;
      flex-shrink: 0;
    }

    &__right {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    &__body {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: 0;
    }

    &__body.is-body-padded {
      padding: var(--gf-panel-pad-y) var(--gf-panel-pad-x);
    }
  }

  .gf-panel-collapse-enter-active,
  .gf-panel-collapse-leave-active {
    transition: all var(--gf-motion-normal) var(--gf-easing);
    overflow: hidden;
  }

  .gf-panel-collapse-enter-from,
  .gf-panel-collapse-leave-to {
    max-height: 0;
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
  }

  .gf-panel-collapse-enter-to,
  .gf-panel-collapse-leave-from {
    max-height: 2000px;
    opacity: 1;
  }
</style>
