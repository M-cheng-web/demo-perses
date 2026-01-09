<template>
  <div v-show="isActive" :class="[bem(), 'ant-tabs-tabpane']">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, type Ref } from 'vue';
  import { createNamespace } from '@/utils';

  const props = defineProps<{
    name?: string | number;
    tab: string;
  }>();

  const [_, bem] = createNamespace('tab-pane');
  const activeKey = inject<Ref<string>>('cc-tabs-active');
  const register = inject<(pane: { key: string; tab: string }) => void>('cc-tabs-register');
  const unregister = inject<(key: string) => void>('cc-tabs-unregister');
  const instance = getCurrentInstance();

  const paneKey = computed(() => {
    return (props.name ?? (instance?.vnode.key as string) ?? props.tab) as string;
  });

  const isActive = computed(() => {
    return activeKey?.value === paneKey.value;
  });

  onMounted(() => {
    register?.({ key: paneKey.value, tab: props.tab });
  });

  onBeforeUnmount(() => {
    unregister?.(paneKey.value);
  });
</script>
