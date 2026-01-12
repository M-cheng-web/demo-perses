<!-- 组件说明：表单容器，提供布局上下文（横向/纵向） -->
<template>
  <form :class="[bem(), bem(`layout-${layout}`)]">
    <slot></slot>
  </form>
</template>

<script setup lang="ts">
  import { provide } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfForm' });

  const props = withDefaults(
    defineProps<{
      /** 表单数据模型（仅透传上下文） */
      model?: Record<string, any>;
      /** 布局方向 */
      layout?: 'horizontal' | 'vertical';
      /** 标签列占比（仅横向） */
      labelCol?: { span: number };
    }>(),
    {
      model: undefined,
      layout: 'vertical',
      labelCol: () => ({ span: 24 }),
    }
  );

  const [_, bem] = createNamespace('form');
  provide('gf-form-layout', props.layout);
  provide('gf-form-label-span', props.labelCol?.span ?? 24);
</script>

<style scoped lang="less">
  .gf-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gf-form--layout-horizontal {
    gap: 10px;
  }
</style>
