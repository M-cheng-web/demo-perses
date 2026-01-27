<!--
  组件说明：骨架屏（灰色 shimmer）

  设计目标：
  - 作为通用的“占位加载”组件，避免页面在请求/渲染阶段出现跳动
  - 默认使用灰色 shimmer 动画；在 `prefers-reduced-motion` 下自动降级为静态背景

  使用方式：
  - 单块占位：<Skeleton :height="120" />
  - 填充父容器：<Skeleton height="100%" />
  - 不加载时渲染真实内容：<Skeleton :loading="loading"><Real /></Skeleton>
-->
<template>
  <slot v-if="!loading"></slot>
  <div
    v-else
    :class="[bem(), { 'is-active': active }]"
    :style="styleVars"
    aria-hidden="true"
  ></div>
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
      width: '100%',
      height: 16,
      radius: 'var(--gf-radius-sm)',
    }
  );

  const [_, bem] = createNamespace('skeleton');

  const px = (v: string | number | undefined): string | undefined => {
    if (v == null) return undefined;
    return typeof v === 'number' ? `${v}px` : v;
  };

  const styleVars = computed(() => ({
    width: px(props.width),
    height: px(props.height),
    borderRadius: px(props.radius),
  }));
</script>

<style scoped lang="less">
  .gf-skeleton {
    display: block;
    width: 100%;
    height: 16px;
    background: var(--gf-color-fill-secondary);
    position: relative;
    overflow: hidden;
  }

  .gf-skeleton.is-active {
    background:
      linear-gradient(
        90deg,
        var(--gf-color-fill-secondary) 25%,
        var(--gf-color-fill-tertiary) 37%,
        var(--gf-color-fill-secondary) 63%
      );
    background-size: 400% 100%;
    animation: gf-skeleton-shimmer 1.2s ease-in-out infinite;
  }

  @keyframes gf-skeleton-shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gf-skeleton.is-active {
      animation: none;
      background: var(--gf-color-fill-secondary);
    }
  }
</style>

