<!-- 组件说明：元素间距容器，支持方向、对齐与换行 -->
<template>
  <div :class="[bem(), bem(`dir-${direction}`)]" :style="inlineStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue';
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSpace' });

  const props = withDefaults(
    defineProps<{
      /** 间距大小或自定义值 */
      size?: number | string;
      /** 布局方向 */
      direction?: 'horizontal' | 'vertical';
      /** 交叉轴对齐 */
      align?: 'start' | 'center' | 'end';
      /** 主轴对齐方式 */
      justify?: 'start' | 'center' | 'end' | 'between';
      /** 是否换行 */
      wrap?: boolean;
    }>(),
    {
      size: 10,
      direction: 'horizontal',
      align: 'center',
      justify: 'start',
      wrap: false,
    }
  );

  const [_, bem] = createNamespace('space');

  const inlineStyle = computed<CSSProperties>(() => {
    const gapValue = typeof props.size === 'number' ? `${props.size}px` : props.size;
    const alignItems: CSSProperties['alignItems'] = props.align === 'start' ? 'flex-start' : props.align === 'end' ? 'flex-end' : 'center';
    const justifyContent: CSSProperties['justifyContent'] =
      props.justify === 'start' ? 'flex-start' : props.justify === 'end' ? 'flex-end' : props.justify === 'between' ? 'space-between' : 'center';
    const flexWrap: CSSProperties['flexWrap'] = props.wrap ? 'wrap' : 'nowrap';
    const flexDirection: CSSProperties['flexDirection'] = props.direction === 'vertical' ? 'column' : 'row';
    return {
      gap: gapValue,
      alignItems,
      justifyContent,
      flexWrap,
      flexDirection,
    };
  });
</script>

<style scoped lang="less">
  .gf-space {
    display: inline-flex;
    width: auto;
  }
</style>
