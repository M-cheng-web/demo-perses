<!-- 组件说明：选项卡容器，管理 TabPane 的切换与注册 -->
<template>
  <div :class="bem()">
    <div :class="bem('nav')">
      <div
        v-for="tab in panes"
        :key="tab.key"
        :class="[bem('tab'), { 'is-active': tab.key === current }]"
        @click="setActive(tab.key)"
      >
        {{ tab.label }}
      </div>
    </div>
    <div :class="bem('content')">
      <slot />
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
    display: flex;
    flex-direction: column;
    gap: var(--gf-space-2);

    &__nav {
      display: flex;
      gap: var(--gf-space-1);
      padding: var(--gf-space-1);
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-md);
      box-shadow: inset 0 1px 0 var(--gf-color-fill);
    }

    &__tab {
      padding: 7px 10px;
      border-radius: var(--gf-radius-sm);
      cursor: pointer;
      color: var(--gf-text-secondary);
      font-size: var(--gf-font-size-sm);
      transition: background var(--gf-motion-fast) var(--gf-easing), color var(--gf-motion-fast) var(--gf-easing),
        box-shadow var(--gf-motion-fast) var(--gf-easing);

      &.is-active {
        background: var(--gf-color-primary-soft);
        color: var(--gf-color-primary);
        box-shadow: none;
      }

      &:hover:not(.is-active) {
        background: var(--gf-color-surface-muted);
      }
    }

    &__content {
      background: var(--gf-color-surface);
      border: 1px solid var(--gf-border);
      border-radius: var(--gf-radius-md);
      padding: var(--gf-space-3);
      box-shadow: var(--gf-shadow-1);
    }
  }
</style>
