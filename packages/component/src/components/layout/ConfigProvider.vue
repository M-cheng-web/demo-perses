<!-- 组件说明：全局配置提供者，用于挂载主题等上下文 -->
<template>
  <div :class="[bem(), themeClass]" :data-gf-theme="colorScheme">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, provide } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY, type GfTheme } from '../../context/theme';

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

  const parentTheme = inject(GF_THEME_CONTEXT_KEY, null);

  const resolvedTheme = computed<GfTheme>(() => {
    if (props.theme !== 'inherit') return props.theme;
    return parentTheme?.theme.value ?? 'inherit';
  });

  const colorScheme = computed(() => {
    // Keep DOM clean when user explicitly requests inherit.
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'dark' : 'light';
  });

  const themeClass = computed(() => {
    if (props.theme === 'inherit') return undefined;
    return props.theme === 'dark' ? 'gf-theme-dark' : 'gf-theme-blue';
  });

  // Provide theme context for Teleport-based components (Drawer/Modal/Dropdown/Select/Tooltip...)
  // so they can still be themed even when teleported outside the provider DOM tree.
  const providedColorScheme = computed(() => {
    if (resolvedTheme.value === 'inherit') return undefined;
    return resolvedTheme.value === 'dark' ? 'dark' : 'light';
  });

  const providedThemeClass = computed(() => {
    if (resolvedTheme.value === 'inherit') return undefined;
    return resolvedTheme.value === 'dark' ? 'gf-theme-dark' : 'gf-theme-blue';
  });

  provide(GF_THEME_CONTEXT_KEY, {
    theme: resolvedTheme,
    colorScheme: providedColorScheme,
    themeClass: providedThemeClass,
  });
</script>

<style scoped>
  .gf-config-provider {
    width: 100%;
    height: 100%;
  }
</style>
