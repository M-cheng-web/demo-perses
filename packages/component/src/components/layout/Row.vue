<!-- 组件说明：栅格行，提供 gutter 间距与换行控制 -->
<template>
  <div :class="bem()" :style="rowStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue';
  import { computed, provide } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfRow' });

  const props = withDefaults(
    defineProps<{
      /** 行间距，支持水平/垂直数组 */
      gutter?: number | [number, number];
      /** 是否换行 */
      wrap?: boolean;
    }>(),
    {
      gutter: 12,
      wrap: true,
    }
  );

  const [_, bem] = createNamespace('row');

  const normalizedGutter = computed<[number, number]>(() => {
    if (Array.isArray(props.gutter)) {
      return [props.gutter[0] ?? 0, props.gutter[1] ?? 0];
    }
    return [props.gutter, props.gutter];
  });

  provide('gf-row-gutter', normalizedGutter);

  const rowStyle = computed<CSSProperties>(() => {
    const [horizontal, vertical] = normalizedGutter.value;
    const flexWrap: CSSProperties['flexWrap'] = props.wrap ? 'wrap' : 'nowrap';
    return {
      display: 'flex',
      flexWrap,
      marginLeft: horizontal ? `-${horizontal / 2}px` : undefined,
      marginRight: horizontal ? `-${horizontal / 2}px` : undefined,
      rowGap: vertical ? `${vertical}px` : undefined,
    };
  });
</script>

<style scoped lang="less">
  .gf-row {
    width: 100%;
  }
</style>
