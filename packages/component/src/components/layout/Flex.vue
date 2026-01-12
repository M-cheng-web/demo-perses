<!-- 组件说明：弹性容器封装，快捷设置主轴/交叉轴对齐与间距 -->
<template>
  <div :class="bem()" :style="inlineStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue';
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfFlex' });

  const props = withDefaults(
    defineProps<{
      /** 间距 */
      gap?: number | string;
      /** 主轴对齐 */
      justify?: 'start' | 'center' | 'end' | 'between';
      /** 交叉轴对齐 */
      align?: 'start' | 'center' | 'end' | 'stretch';
      /** 是否换行 */
      wrap?: boolean;
    }>(),
    {
      gap: 12,
      justify: 'start',
      align: 'center',
      wrap: false,
    }
  );

  const [_, bem] = createNamespace('flex');

  const inlineStyle = computed<CSSProperties>(() => {
    const justifyContent: CSSProperties['justifyContent'] =
      props.justify === 'start' ? 'flex-start' : props.justify === 'end' ? 'flex-end' : props.justify === 'between' ? 'space-between' : 'center';
    const alignItems: CSSProperties['alignItems'] =
      props.align === 'start' ? 'flex-start' : props.align === 'end' ? 'flex-end' : props.align === 'stretch' ? 'stretch' : 'center';
    const flexWrap: CSSProperties['flexWrap'] = props.wrap ? 'wrap' : 'nowrap';

    return {
      display: 'flex',
      gap: typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
      justifyContent,
      alignItems,
      flexWrap,
    };
  });
</script>

<style scoped lang="less">
  .gf-flex {
    width: 100%;
  }
</style>
