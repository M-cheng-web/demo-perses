<!-- 组件说明：选项卡容器，管理 TabPane 的切换与注册 -->
<template>
  <div :class="bem()">
    <div :class="bem('nav')">
      <div v-for="tab in panes" :key="tab.key" :class="[bem('tab'), { 'is-active': tab.key === current }]" @click="setActive(tab.key)">
        {{ tab.label }}
      </div>
    </div>
    <div :class="bem('content')">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { provide, reactive, ref, watch } from 'vue';
  import { createNamespace } from '../../utils';

  defineOptions({ name: 'GfTabs' });

  const props = defineProps<{
    /** 当前激活的标签键值 */
    activeKey?: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:activeKey', key: string): void;
  }>();

  const [_, bem] = createNamespace('tabs');
  const panes = reactive<{ key: string; label: string }[]>([]);
  const current = ref(props.activeKey || '');

  const setActive = (key: string) => {
    current.value = key;
    emit('update:activeKey', key);
  };

  watch(
    () => props.activeKey,
    (val) => {
      if (val) current.value = val;
    }
  );

  provide('gf-tabs-register', (pane: { key: string; label: string }) => {
    if (!panes.find((p) => p.key === pane.key)) {
      panes.push(pane);
    }
    if (!current.value) {
      setActive(pane.key);
    }
  });

  provide('gf-tabs-unregister', (key: string) => {
    const index = panes.findIndex((p) => p.key === key);
    if (index !== -1) panes.splice(index, 1);
  });

  provide('gf-tabs-active', current);
</script>

<style scoped lang="less">
  .gf-tabs {
    --gf-tabs-gap: var(--gf-space-2);
    --gf-tabs-border: 1px solid var(--gf-color-border);
    --gf-tabs-radius: var(--gf-radius-md);
    --gf-tabs-bg: var(--gf-color-surface);
    --gf-tabs-nav-padding: 6px 8px;
    --gf-tabs-nav-border: 1px solid var(--gf-color-border-muted);
    --gf-tabs-tab-padding: 6px 10px;
    --gf-tabs-tab-min-width: auto;
    --gf-tabs-content-padding: var(--gf-space-3);
    --gf-tabs-content-display: block;

    display: flex;
    flex-direction: column;
    gap: var(--gf-tabs-gap);
    border: var(--gf-tabs-border);
    border-radius: var(--gf-tabs-radius);
    background: var(--gf-tabs-bg);

    &__nav {
      display: flex;
      gap: var(--gf-space-1);
      padding: var(--gf-tabs-nav-padding);
      background: transparent;
      border-bottom: var(--gf-tabs-nav-border);
    }

    &__tab {
      min-width: var(--gf-tabs-tab-min-width);
      padding: var(--gf-tabs-tab-padding);
      border-radius: var(--gf-radius-xs);
      cursor: pointer;
      color: var(--gf-text-secondary);
      font-size: var(--gf-font-size-sm);
      transition:
        background var(--gf-motion-fast) var(--gf-easing),
        color var(--gf-motion-fast) var(--gf-easing);

      &.is-active {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
        box-shadow: inset 0 -2px 0 var(--gf-color-primary);
      }

      &:hover:not(.is-active) {
        background: var(--gf-color-fill);
        color: var(--gf-color-text);
      }
    }

    &__content {
      display: var(--gf-tabs-content-display);
      padding: var(--gf-tabs-content-padding);
    }
  }
</style>
