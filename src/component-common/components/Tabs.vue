<template>
  <div :class="[bem(), 'cc-tabs', 'ant-tabs']">
    <div :class="['cc-tabs__nav', 'ant-tabs-nav']">
      <div
        v-for="pane in panes"
        :key="pane.key"
        :class="['cc-tabs__tab', 'ant-tabs-tab', { 'is-active': pane.key === currentActive }]"
        @click="setActive(pane.key)"
      >
        {{ pane.tab }}
      </div>
    </div>
    <div :class="['cc-tabs__content', 'ant-tabs-content']">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { provide, reactive, ref, watch } from 'vue';
  import { createNamespace } from '@/utils';

  const props = withDefaults(
    defineProps<{
      activeKey?: string;
    }>(),
    {
      activeKey: '',
    }
  );

  const emit = defineEmits<{
    (e: 'update:activeKey', val: string): void;
  }>();

  const [_, bem] = createNamespace('tabs');

  const panes = reactive<{ key: string; tab: string }[]>([]);
  const currentActive = ref(props.activeKey);

  const setActive = (key: string) => {
    currentActive.value = key;
    emit('update:activeKey', key);
  };

  const register = (pane: { key: string; tab: string }) => {
    if (!panes.find((p) => p.key === pane.key)) {
      panes.push(pane);
    }
    if (!currentActive.value) {
      setActive(pane.key);
    }
  };

  const unregister = (key: string) => {
    const index = panes.findIndex((p) => p.key === key);
    if (index !== -1) {
      panes.splice(index, 1);
    }
  };

  watch(
    () => props.activeKey,
    (val) => {
      if (val) {
        currentActive.value = val;
      }
    }
  );

  provide('cc-tabs-register', register);
  provide('cc-tabs-unregister', unregister);
  provide('cc-tabs-active', currentActive);
</script>
