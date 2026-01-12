<!-- 组件说明：用于展示状态/标记的小标签，可自定义颜色 -->
<template>
  <span :class="bem()" :style="tagStyle">
    <slot />
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTag' });

  const props = withDefaults(
    defineProps<{
      /** 标签主色，影响背景/描边/文字 */
      color?: string;
    }>(),
    { color: '#3a78dd' }
  );

  const [_, bem] = createNamespace('tag');

  const tagStyle = computed(() => ({
    background: `${props.color}22`,
    border: `1px solid ${props.color}55`,
    color: props.color,
    boxShadow: 'none',
  }));
</script>

<style scoped lang="less">
  .gf-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1.4;
    gap: 6px;
  }
</style>
