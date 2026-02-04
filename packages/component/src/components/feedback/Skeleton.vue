<!--
  组件说明：骨架屏（灰色 shimmer）(AntD-inspired)

  设计目标：
  - 作为通用的"占位加载"组件，避免页面在请求/渲染阶段出现跳动
  - 默认使用灰色 shimmer 动画；在 `prefers-reduced-motion` 下自动降级为静态背景

  使用方式：
  - 单块占位：<Skeleton :height="120" />
  - 填充父容器：<Skeleton height="100%" />
  - 不加载时渲染真实内容：<Skeleton :loading="loading"><Real /></Skeleton>
  - 段落占位：<Skeleton paragraph />
  - 头像占位：<Skeleton avatar />
-->
<template>
  <slot v-if="!loading"></slot>
  <div v-else :class="[bem(), { 'is-active': active, 'is-with-avatar': avatar }]" aria-hidden="true">
    <div v-if="avatar" :class="[bem('avatar'), bem('avatar', avatarShape)]"></div>
    <div :class="bem('content')">
      <div v-if="title" :class="bem('title')"></div>
      <div v-if="paragraph" :class="bem('paragraph')">
        <div
          v-for="(_, i) in paragraphRows"
          :key="i"
          :class="bem('paragraph-row')"
          :style="{ width: i === paragraphRows.length - 1 ? '61%' : undefined }"
        ></div>
      </div>
      <div v-if="!title && !paragraph" :class="bem('block')" :style="styleVars"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSkeleton' });

  const props = withDefaults(
    defineProps<{
      /** 是否处于加载状态；为 false 时渲染默认 slot */
      loading?: boolean;
      /** 是否开启 shimmer 动画 */
      active?: boolean;
      /** 是否显示头像占位图 */
      avatar?: boolean;
      /** 头像形状 */
      avatarShape?: 'circle' | 'square';
      /** 是否显示标题占位图 */
      title?: boolean;
      /** 是否显示段落占位图 */
      paragraph?: boolean;
      /** 段落行数 */
      rows?: number;
      /** 宽度（number 视为 px） */
      width?: string | number;
      /** 高度（number 视为 px） */
      height?: string | number;
      /** 圆角（number 视为 px） */
      radius?: string | number;
    }>(),
    {
      loading: true,
      active: true,
      avatar: false,
      avatarShape: 'circle',
      title: false,
      paragraph: false,
      rows: 3,
      width: '100%',
      height: 16,
      radius: 'var(--gf-radius-xs)',
    }
  );

  const [_ns, bem] = createNamespace('skeleton');

  const px = (v: string | number | undefined): string | undefined => {
    if (v == null) return undefined;
    return typeof v === 'number' ? `${v}px` : v;
  };

  const styleVars = computed(() => ({
    width: px(props.width),
    height: px(props.height),
    borderRadius: px(props.radius),
  }));

  const paragraphRows = computed(() => Array(props.rows).fill(null));
</script>

<style scoped lang="less">
  .gf-skeleton {
    display: flex;
    gap: 16px;

    &.is-with-avatar {
      align-items: flex-start;
    }

    &__avatar {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      background: var(--gf-color-fill-secondary);

      &--circle {
        border-radius: 50%;
      }

      &--square {
        border-radius: var(--gf-radius-sm);
      }
    }

    &__content {
      flex: 1;
      min-width: 0;
    }

    &__title {
      width: 38%;
      height: 16px;
      margin-bottom: 16px;
      background: var(--gf-color-fill-secondary);
      border-radius: var(--gf-radius-xs);
    }

    &__paragraph {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    &__paragraph-row {
      width: 100%;
      height: 16px;
      background: var(--gf-color-fill-secondary);
      border-radius: var(--gf-radius-xs);
    }

    &__block {
      display: block;
      background: var(--gf-color-fill-secondary);
    }

    // Animation
    &.is-active &__avatar,
    &.is-active &__title,
    &.is-active &__paragraph-row,
    &.is-active &__block {
      background: linear-gradient(90deg, var(--gf-color-fill-secondary) 25%, var(--gf-color-fill-tertiary) 37%, var(--gf-color-fill-secondary) 63%);
      background-size: 400% 100%;
      animation: gf-skeleton-shimmer 1.4s ease infinite;
    }
  }

  @keyframes gf-skeleton-shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gf-skeleton.is-active &__avatar,
    .gf-skeleton.is-active &__title,
    .gf-skeleton.is-active &__paragraph-row,
    .gf-skeleton.is-active &__block {
      animation: none;
      background: var(--gf-color-fill-secondary);
    }
  }
</style>
