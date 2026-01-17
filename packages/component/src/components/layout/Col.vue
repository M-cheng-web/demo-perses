<!-- 组件说明：栅格列，按照 24 栅格占比计算宽度 -->
<template>
  <div :class="bem()" :style="colStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { ComputedRef } from 'vue';
  import { computed, inject } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfCol' });

  const props = withDefaults(
    defineProps<{
      /** 占据 24 栅格中的列数 */
      span?: number;
    }>(),
    {
      span: 24,
    }
  );

  const [_, bem] = createNamespace('col');
  const gutter = inject<ComputedRef<[number, number]>>(
    'gf-row-gutter',
    computed(() => [0, 0] as [number, number])
  );

  const colStyle = computed(() => {
    const width = `${(props.span / 24) * 100}%`;
    const [horizontal] = gutter.value;
    return {
      flex: `0 0 ${width}`,
      maxWidth: width,
      paddingLeft: horizontal ? `${horizontal / 2}px` : undefined,
      paddingRight: horizontal ? `${horizontal / 2}px` : undefined,
    };
  });
</script>

<style scoped lang="less">
  .gf-col {
    min-height: 1px;
  }
</style>
