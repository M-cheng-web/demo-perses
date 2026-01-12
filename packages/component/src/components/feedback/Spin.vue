<!-- 组件说明：加载指示器包装，可配合表格等场景 -->
<template>
  <div :class="bem()">
    <Loading :text="tip" />
  </div>
</template>

<script setup lang="ts">
  import Loading from '../base/Loading.vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfSpin' });

  withDefaults(
    defineProps<{
      spinning?: boolean;
      tip?: string;
    }>(),
    {
      spinning: true,
      tip: '',
    }
  );

  const [_, bem] = createNamespace('spin');
</script>

<style scoped lang="less">
  .gf-spin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>
