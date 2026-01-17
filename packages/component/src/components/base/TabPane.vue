<!-- 组件说明：Tabs 内的单个选项卡面板 -->
<template>
  <div v-show="isActive" :class="bem()">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, onBeforeUnmount, onMounted, type Ref } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTabPane' });

  const props = defineProps<{
    /** 唯一键，用于激活切换 */
    name: string;
    /** 标签显示文案 */
    tab: string;
  }>();

  const [_, bem] = createNamespace('tab-pane');
  const active = inject<Ref<string>>('gf-tabs-active');
  const register = inject<(pane: { key: string; label: string }) => void>('gf-tabs-register');
  const unregister = inject<(key: string) => void>('gf-tabs-unregister');

  const isActive = computed(() => active?.value === props.name);

  onMounted(() => {
    register?.({ key: props.name, label: props.tab });
  });

  onBeforeUnmount(() => {
    unregister?.(props.name);
  });
</script>

<style scoped>
  .gf-tab-pane {
    width: 100%;
  }
</style>
