<!-- 组件说明：全局配置提供者，用于挂载主题等上下文 -->
<template>
  <div :class="[bem(), themeClass]" :data-gf-theme="colorScheme">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';
  import { GF_THEME_CONTEXT_KEY, type GfTheme } from '../../context/theme';
  import { GF_PORTAL_CONTEXT_KEY } from '../../context/portal';

  defineOptions({ name: 'GfConfigProvider' });

  const props = withDefaults(
    defineProps<{
      /** 主题标识（预留多主题） */
      theme?: GfTheme;
      /** 语言配置（预留） */
      locale?: any;
      /**
       * Portal 挂载点（Teleport 目标容器）
       *
       * 默认挂到 `document.body` 下的 `.gf-portal-root`。
       * 嵌入式场景可指定为宿主容器（例如 dashboard 容器），以便：
       * - 统一浮层挂载点（便于销毁/隔离）
       * - 让全局 message 等也能继承主题 token
       */
      portalTarget?: string | HTMLElement | null;
    }>(),
    {
      theme: 'light',
      locale: undefined,
      portalTarget: null,
    }
  );

  const [_, bem] = createNamespace('config-provider');

  const colorScheme = computed(() => props.theme);
  const themeClass = computed(() => (props.theme === 'dark' ? 'gf-theme-dark' : 'gf-theme-light'));

  provide(GF_THEME_CONTEXT_KEY, {
    theme: computed(() => props.theme),
    colorScheme,
    themeClass,
  });

  // ------------------------------------------------------------
  // Portal root for Teleport-based components
  // ------------------------------------------------------------
  const portalRootEl = ref<HTMLElement | null>(null);

  const resolveMountEl = (target: string | HTMLElement | null | undefined): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    if (!target) return document.body;
    if (typeof target === 'string') return document.querySelector<HTMLElement>(target) ?? document.body;
    return target;
  };

  const ensurePortalRoot = () => {
    if (typeof document === 'undefined') return;
    if (portalRootEl.value) return;
    const el = document.createElement('div');
    el.className = 'gf-portal-root';
    portalRootEl.value = el;
  };

  const syncPortalMount = () => {
    ensurePortalRoot();
    const el = portalRootEl.value;
    if (!el) return;
    const mountEl = resolveMountEl(props.portalTarget);
    if (!mountEl) return;
    if (el.parentElement !== mountEl) mountEl.appendChild(el);
  };

  const syncPortalTheme = () => {
    const el = portalRootEl.value;
    if (!el) return;
    const cls = themeClass.value;
    el.className = ['gf-portal-root', cls].filter(Boolean).join(' ');
    const scheme = colorScheme.value;
    if (scheme) el.setAttribute('data-gf-theme', scheme);
    else el.removeAttribute('data-gf-theme');
  };

  const portalTeleportTarget = computed(() => portalRootEl.value ?? 'body');
  provide(GF_PORTAL_CONTEXT_KEY, { target: portalTeleportTarget });

  onMounted(() => {
    syncPortalMount();
    syncPortalTheme();
  });

  watch(
    () => props.portalTarget,
    () => syncPortalMount()
  );

  watch([themeClass, colorScheme], () => syncPortalTheme());

  onBeforeUnmount(() => {
    portalRootEl.value?.remove();
    portalRootEl.value = null;
  });
</script>

<style scoped>
  .gf-config-provider {
    width: 100%;
    height: 100%;
  }
</style>
