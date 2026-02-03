<!-- 组件说明：元素间距容器，支持方向、对齐与换行 (AntD-inspired) -->
<template>
  <div :class="[bem(), bem(`dir-${direction}`), { 'is-wrap': wrap, [`gf-space--size-${sizePreset}`]: sizePreset }]" :style="inlineStyle">
    <template v-for="(child, index) in $slots.default?.()" :key="index">
      <div v-if="split && index > 0" :class="bem('split')">
        <slot name="split">
          <span :class="bem('split-default')"></span>
        </slot>
      </div>
      <div :class="bem('item')">
        <component :is="child" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue';
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSpace' });

  const props = withDefaults(
    defineProps<{
      /** 间距大小：预设值或自定义数值 */
      size?: 'small' | 'middle' | 'large' | number | [number, number];
      /** 布局方向 */
      direction?: 'horizontal' | 'vertical';
      /** 交叉轴对齐 */
      align?: 'start' | 'center' | 'end' | 'baseline';
      /** 主轴对齐方式 */
      justify?: 'start' | 'center' | 'end' | 'between';
      /** 是否换行 */
      wrap?: boolean;
      /** 是否显示分隔符 */
      split?: boolean;
    }>(),
    {
      size: 'small',
      direction: 'horizontal',
      align: 'center',
      justify: 'start',
      wrap: false,
      split: false,
    }
  );

  const [_, bem] = createNamespace('space');

  const sizePreset = computed(() => {
    if (typeof props.size === 'string') return props.size;
    return null;
  });

  const inlineStyle = computed<CSSProperties>(() => {
    const style: CSSProperties = {};

    // Gap
    if (typeof props.size === 'number') {
      style.gap = `${props.size}px`;
    } else if (Array.isArray(props.size)) {
      style.columnGap = `${props.size[0]}px`;
      style.rowGap = `${props.size[1]}px`;
    }

    // Align
    switch (props.align) {
      case 'start':
        style.alignItems = 'flex-start';
        break;
      case 'end':
        style.alignItems = 'flex-end';
        break;
      case 'baseline':
        style.alignItems = 'baseline';
        break;
      default:
        style.alignItems = 'center';
    }

    // Justify
    switch (props.justify) {
      case 'end':
        style.justifyContent = 'flex-end';
        break;
      case 'center':
        style.justifyContent = 'center';
        break;
      case 'between':
        style.justifyContent = 'space-between';
        break;
      default:
        style.justifyContent = 'flex-start';
    }

    return style;
  });
</script>

<style scoped lang="less">
  .gf-space {
    display: inline-flex;
    width: auto;

    &--dir-horizontal {
      flex-direction: row;
    }

    &--dir-vertical {
      flex-direction: column;
      width: 100%;
    }

    &.is-wrap {
      flex-wrap: wrap;
    }

    // Size presets (AntD standard)
    &--size-small {
      gap: 8px;
    }

    &--size-middle {
      gap: 16px;
    }

    &--size-large {
      gap: 24px;
    }

    &__item {
      display: inline-flex;
    }

    &__split {
      display: inline-flex;
      align-items: center;
      color: var(--gf-color-text-tertiary);
    }

    &__split-default {
      width: 1px;
      height: 1em;
      background: var(--gf-color-border);
    }
  }
</style>
