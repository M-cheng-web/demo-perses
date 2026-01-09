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
  import { createNamespace } from '/#/utils';

  const props = defineProps<{
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
  .dp-tabs {
    --gf-primary: #69b1ff;
    --gf-border: #d8e5f5;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &__nav {
      display: flex;
      gap: 8px;
      padding: 4px;
      background: #f6f9ff;
      border: 1px solid var(--gf-border);
      border-radius: 10px;
    }

    &__tab {
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      color: #3b4a62;
      transition: all 0.15s ease;

      &.is-active {
        background: linear-gradient(135deg, var(--gf-primary), #4f94f5);
        color: #fff;
        box-shadow: 0 8px 14px rgba(79, 148, 245, 0.2);
      }

      &:hover:not(.is-active) {
        background: #eaf2ff;
      }
    }

    &__content {
      background: #fff;
      border: 1px solid var(--gf-border);
      border-radius: 10px;
      padding: 12px;
    }
  }
</style>
