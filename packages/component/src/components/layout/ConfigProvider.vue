<!-- 组件说明：全局配置提供者，用于挂载主题等上下文 -->
<template>
  <div :class="[bem(), themeClass]" :data-gf-theme="colorScheme">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfConfigProvider' });

  const props = withDefaults(
    defineProps<{
      /** 主题标识（预留多主题） */
      theme?: 'blue' | 'light' | 'dark' | 'inherit';
      /** 语言配置（预留） */
      locale?: any;
    }>(),
    {
      theme: 'blue',
      locale: undefined,
    }
  );

  const [_, bem] = createNamespace('config-provider');

  const colorScheme = computed(() => {
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'dark' : 'light';
  });

  const themeClass = computed(() => {
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'gf-theme-dark' : 'gf-theme-blue';
  });
</script>

<style scoped>
  .gf-config-provider {
    width: 100%;
    height: 100%;
  }
</style>
